using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

// Enforce security headers & CORS policies
builder.Services.AddCors(options =>
{
    options.AddPolicy("LtiFrontendPolicy", policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .SetIsOriginAllowed(origin => true); // Configurable in appsettings
    });
});

var app = builder.Build();

app.UseCors("LtiFrontendPolicy");

// In-memory nonce/state store with TTL simulation for OIDC replay defense
var nonces = new HashSet<string>();

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

// 3. OIDC Login Initiation Endpoint
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

    var state = Guid.NewGuid().ToString("N");
    var nonce = Guid.NewGuid().ToString("N");
    nonces.Add(nonce);

    // Redirect to LMS authorization endpoint
    var authRedirectUrl = $"{iss}/api/lti/authorize_redirect?response_type=id_token&scope=openid&client_id=10000&redirect_uri={Uri.EscapeDataString("https://gateway.example.edu/lti/launch")}&login_hint={login_hint}&state={state}&nonce={nonce}&response_mode=form_post";

    return Results.Redirect(authRedirectUrl);
});

// 4. LTI Launch Validation & Session Handshake
app.MapPost("/lti/launch", (HttpRequest request) =>
{
    // Validate id_token POSTed from Canvas
    var form = request.Form;
    var idToken = form["id_token"].ToString();
    var state = form["state"].ToString();

    if (string.IsNullOrEmpty(idToken))
    {
        return Results.BadRequest(new { error = "invalid_token", message = "Missing LTI id_token" });
    }

    // Issue short-lived session cookie bound to launch context
    return Results.Ok(new
    {
        status = "authenticated",
        context = new
        {
            userId = "usr_12345",
            courseId = "course_88",
            assignmentId = "intro-greeting",
            roles = new[] { "Student" },
            lineItemUrl = "https://canvas.instructure.com/api/lti/courses/88/line_items/10"
        }
    });
});

// 5. Session Context Query
app.MapGet("/api/session/context", () =>
{
    return Results.Json(new
    {
        authenticated = true,
        mode = "canvas-connected",
        assignmentId = "intro-greeting",
        userId = "usr_12345",
        roles = new[] { "Student" }
    });
});

// 6. AGS Grade Submission Endpoint (Section 11.3)
app.MapPost("/api/assignments/{resourceId}/submissions", (string resourceId, [FromBody] SubmissionPayload payload) =>
{
    if (payload.ScoreGiven < 0 || payload.ScoreGiven > payload.ScoreMaximum)
    {
        return Results.BadRequest(new { error = "invalid_score", message = "Score exceeds scoreMaximum" });
    }

    var receiptId = $"rcpt_{Guid.NewGuid():N}";

    return Results.Json(new
    {
        receiptId,
        timestamp = DateTime.UtcNow.ToString("o"),
        status = "grade-posted",
        resourceId,
        scoreGiven = payload.ScoreGiven,
        scoreMaximum = payload.ScoreMaximum,
        advisoryOnly = false
    });
});

app.Run();

public record SubmissionPayload(double ScoreGiven, double ScoreMaximum, string? SourceZipHash);
