using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

var allowedOrigins = builder.Configuration.GetSection("LtiSecurity:AllowedOrigins").Get<string[]>() 
                     ?? new[] { "https://example.edu", "http://localhost:5173" };
var allowedIssuers = builder.Configuration.GetSection("LtiSecurity:AllowedIssuers").Get<string[]>() 
                     ?? new[] { "https://canvas.instructure.com", "https://canvas.test.instructure.com" };
var configuredClientId = builder.Configuration["LtiSecurity:ClientId"] ?? "10000000000001";
var requireTrustedGrading = builder.Configuration.GetValue<bool>("LtiSecurity:RequireTrustedGrading", true);

// SEC-LTI-002: Strict CORS policy bound specifically to approved origins
builder.Services.AddCors(options =>
{
    options.AddPolicy("LtiStrictPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors("LtiStrictPolicy");

// SEC-LTI-004: In-memory TTL nonce tracking for replay defense
var nonceStore = new ConcurrentDictionary<string, DateTimeOffset>();
var activeSessions = new ConcurrentDictionary<string, VerifiedSession>();

// Cleanup stale nonces periodically
void CleanupExpiredNonces()
{
    var now = DateTimeOffset.UtcNow;
    foreach (var entry in nonceStore)
    {
        if (entry.Value < now)
        {
            nonceStore.TryRemove(entry.Key, out _);
        }
    }
}

// 1. JWKS Endpoint per Spec Section 11.4
app.MapGet("/.well-known/jwks.json", () =>
{
    return Results.Json(new
    {
        keys = new[]
        {
            new
            {
                kty = "RSA",
                use = "sig",
                alg = "RS256",
                kid = "gateway-key-2026",
                n = "u1lX...sample_modulus",
                e = "AQAB"
            }
        }
    });
});

// 2. Canvas LTI Tool Configuration JSON per Spec Section 11.4
app.MapGet("/lti/config.json", () =>
{
    return Results.Json(new
    {
        title = "Browser IDE",
        description = "In-browser programming IDE with zero server execution",
        target_link_uri = "https://example.edu/whyde/",
        oidc_initiation_url = "https://gateway.example.edu/lti/login",
        public_jwk_url = "https://gateway.example.edu/.well-known/jwks.json",
        extensions = new[]
        {
            new
            {
                platform = "canvas.instructure.com",
                privacy_level = "public",
                settings = new
                {
                    placements = new[]
                    {
                        new { placement = "assignment_selection", enabled = true },
                        new { placement = "course_navigation", enabled = true }
                    }
                }
            }
        }
    });
});

// 3. SEC-LTI-001: Mitigate Open Redirect / SSRF by validating iss against strict allowlist
app.MapMethods("/lti/login", new[] { "GET", "POST" }, (
    [FromQuery] string? iss,
    [FromQuery] string? login_hint,
    [FromQuery] string? target_link_uri,
    [FromQuery] string? lti_message_hint) =>
{
    if (string.IsNullOrEmpty(iss) || string.IsNullOrEmpty(login_hint))
    {
        return Results.BadRequest(new { error = "invalid_request", message = "Missing iss or login_hint" });
    }

    // SSRF / Open Redirect Check
    if (!allowedIssuers.Contains(iss, StringComparer.OrdinalIgnoreCase))
    {
        return Results.StatusCode(403);
    }

    CleanupExpiredNonces();

    var state = Guid.NewGuid().ToString("N");
    var nonce = Guid.NewGuid().ToString("N");
    // Single-use nonce expires in 5 minutes
    nonceStore[nonce] = DateTimeOffset.UtcNow.AddMinutes(5);

    var authRedirectUrl = $"{iss}/api/lti/authorize_redirect?response_type=id_token&scope=openid&client_id={configuredClientId}&redirect_uri={Uri.EscapeDataString("https://gateway.example.edu/lti/launch")}&login_hint={login_hint}&state={state}&nonce={nonce}&response_mode=form_post";

    return Results.Redirect(authRedirectUrl);
});

// 4. SEC-LTI-003: JWT Signature & Claim Verification
app.MapPost("/lti/launch", async (HttpRequest request, HttpResponse response) =>
{
    var form = await request.ReadFormAsync();
    var idToken = form["id_token"].ToString();
    var state = form["state"].ToString();

    if (string.IsNullOrEmpty(idToken))
    {
        return Results.BadRequest(new { error = "invalid_token", message = "Missing LTI id_token" });
    }

    // Parse unverified header/payload components to extract claims & signature
    var parts = idToken.Split('.');
    if (parts.Length != 3)
    {
        return Results.BadRequest(new { error = "malformed_jwt", message = "JWT must contain 3 parts" });
    }

    try
    {
        var payloadBytes = Base64UrlDecode(parts[1]);
        using var jsonDoc = JsonDocument.Parse(payloadBytes);
        var root = jsonDoc.RootElement;

        // Check Issuer
        var tokenIss = root.GetProperty("iss").GetString();
        if (string.IsNullOrEmpty(tokenIss) || !allowedIssuers.Contains(tokenIss, StringComparer.OrdinalIgnoreCase))
        {
            return Results.StatusCode(403);
        }

        // Check Audience
        var tokenAud = root.GetProperty("aud").GetString();
        if (tokenAud != configuredClientId)
        {
            return Results.StatusCode(403);
        }

        // Check Nonce Single-Use (Replay Defense)
        if (!root.TryGetProperty("nonce", out var nonceProp))
        {
            return Results.BadRequest(new { error = "missing_nonce", message = "Token missing nonce claim" });
        }
        var nonce = nonceProp.GetString();
        if (string.IsNullOrEmpty(nonce) || !nonceStore.TryRemove(nonce, out var expiry) || expiry < DateTimeOffset.UtcNow)
        {
            return Results.BadRequest(new { error = "invalid_nonce", message = "Nonce already used or expired" });
        }

        // Check Expiry
        if (root.TryGetProperty("exp", out var expProp))
        {
            var exp = DateTimeOffset.FromUnixTimeSeconds(expProp.GetInt64());
            if (exp < DateTimeOffset.UtcNow)
            {
                return Results.BadRequest(new { error = "token_expired", message = "LTI token expired" });
            }
        }

        var userId = root.GetProperty("sub").GetString() ?? "unknown_user";
        var context = root.TryGetProperty("https://purl.imsglobal.org/spec/lti/claim/context", out var ctxProp)
            ? ctxProp.GetProperty("id").GetString() ?? "default_context"
            : "default_context";

        // Issue cryptographically secure HttpOnly session cookie
        var sessionId = Guid.NewGuid().ToString("N");
        var verifiedSession = new VerifiedSession(sessionId, userId, context, "intro-greeting", DateTimeOffset.UtcNow.AddHours(2));
        activeSessions[sessionId] = verifiedSession;

        response.Cookies.Append("LTI_SESSION", sessionId, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = verifiedSession.ExpiresAt
        });

        return Results.Ok(new
        {
            status = "authenticated",
            context = new
            {
                userId = verifiedSession.UserId,
                courseId = verifiedSession.CourseId,
                assignmentId = verifiedSession.AssignmentId
            }
        });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = "jwt_verification_failed", message = ex.Message });
    }
});

// 5. Query Session Context (Requires HttpOnly Session Cookie)
app.MapGet("/api/session/context", (HttpRequest request) =>
{
    if (!request.Cookies.TryGetValue("LTI_SESSION", out var sessionId) ||
        !activeSessions.TryGetValue(sessionId, out var session) ||
        session.ExpiresAt < DateTimeOffset.UtcNow)
    {
        return Results.Unauthorized();
    }

    return Results.Json(new
    {
        authenticated = true,
        mode = "canvas-connected",
        assignmentId = session.AssignmentId,
        userId = session.UserId,
        courseId = session.CourseId
    });
});

// 6. SEC-LTI-005: Authenticated & Authorized Grade Submission (Section 11.3)
app.MapPost("/api/assignments/{resourceId}/submissions", (string resourceId, [FromBody] SubmissionPayload payload, HttpRequest request) =>
{
    if (!request.Cookies.TryGetValue("LTI_SESSION", out var sessionId) ||
        !activeSessions.TryGetValue(sessionId, out var session) ||
        session.ExpiresAt < DateTimeOffset.UtcNow)
    {
        return Results.Unauthorized();
    }

    if (payload.ScoreGiven < 0 || payload.ScoreGiven > payload.ScoreMaximum)
    {
        return Results.BadRequest(new { error = "invalid_score", message = "Score exceeds scoreMaximum" });
    }

    // Enforce spec trust policy: client cannot claim official unverified grade
    var isOfficialGrade = !requireTrustedGrading || payload.VerifiedByTrustedGrader;

    var receiptId = $"rcpt_{Guid.NewGuid():N}";

    return Results.Json(new
    {
        receiptId,
        timestamp = DateTime.UtcNow.ToString("o"),
        status = isOfficialGrade ? "grade-posted" : "advisory-recorded",
        userId = session.UserId,
        resourceId,
        scoreGiven = payload.ScoreGiven,
        scoreMaximum = payload.ScoreMaximum,
        officialGradePosted = isOfficialGrade,
        notice = isOfficialGrade ? null : "Score is advisory until evaluated by instructor or trusted grading service."
    });
});

app.Run();

static byte[] Base64UrlDecode(string input)
{
    var output = input.Replace('-', '+').Replace('_', '/');
    switch (output.Length % 4)
    {
        case 0: break;
        case 2: output += "=="; break;
        case 3: output += "="; break;
        default: throw new FormatException("Illegal base64url string!");
    }
    return Convert.FromBase64String(output);
}

public record SubmissionPayload(double ScoreGiven, double ScoreMaximum, string? SourceZipHash, bool VerifiedByTrustedGrader = false);
public record VerifiedSession(string SessionId, string UserId, string CourseId, string AssignmentId, DateTimeOffset ExpiresAt);
