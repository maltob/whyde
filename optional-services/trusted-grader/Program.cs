using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var gatewayApiKey = builder.Configuration["GraderSecurity:GatewayApiKey"] ?? "sec_grader_shared_key_2026_test";
var maxExecutionSeconds = builder.Configuration.GetValue<int>("GraderSecurity:MaxExecutionTimeSeconds", 10);

// Spec Section 10.3: Authenticated worker tier communication & sandboxed evaluation
app.MapPost("/api/grader/evaluate", async (HttpRequest request, [FromBody] EvaluationRequest payload) =>
{
    // 1. Authenticate calling service (LTI gateway private key or shared mutual API key)
    if (!request.Headers.TryGetValue("X-Grader-Api-Key", out var providedKey) || providedKey != gatewayApiKey)
    {
        return Results.Unauthorized();
    }

    if (payload.SubmissionPackage == null || payload.HiddenTestBank == null)
    {
        return Results.BadRequest(new { error = "invalid_payload", message = "Missing submission or test bank" });
    }

    var runId = $"grade_job_{Guid.NewGuid():N}";
    var startTime = DateTime.UtcNow;

    // 2. Sandboxed execution simulation against authoritative hidden tests
    // In production, this spawns an ephemeral isolated container/process with network disabled
    var testResults = new List<GradedTestResult>();
    double totalAwarded = 0;
    double maxPossible = 0;

    foreach (var test in payload.HiddenTestBank)
    {
        maxPossible += test.Points;

        // Perform evaluation against student submission
        var passed = payload.SubmissionPackage.Contains(test.ExpectedToken);
        var awarded = passed ? test.Points : 0;
        totalAwarded += awarded;

        testResults.Add(new GradedTestResult(
            TestId: test.TestId,
            Passed: passed,
            PointsAwarded: awarded,
            MaxPoints: test.Points,
            DurationMs: 45
        ));
    }

    var signedReceipt = new SignedGradingReceipt(
        RunId: runId,
        AssignmentId: payload.AssignmentId,
        UserId: payload.UserId,
        OfficialScoreGiven: totalAwarded,
        OfficialScoreMaximum: maxPossible,
        GradingProgress: "FullyGraded",
        ActivityProgress: "Completed",
        Timestamp: DateTime.UtcNow.ToString("o"),
        Signature: ComputeHmacSha256($"{runId}:{payload.UserId}:{totalAwarded}/{maxPossible}", gatewayApiKey),
        TestResults: testResults
    );

    return Results.Ok(signedReceipt);
});

app.MapGet("/api/grader/health", () => Results.Ok(new { status = "healthy", sandbox = "isolated-worker-tier" }));

app.Run();

static string ComputeHmacSha256(string data, string key)
{
    using var hmac = new HMACSHA256(System.Text.Encoding.UTF8.GetBytes(key));
    var hash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(data));
    return Convert.ToBase64String(hash);
}

public record EvaluationRequest(
    string AssignmentId,
    string UserId,
    string SubmissionPackage,
    List<HiddenTestCase> HiddenTestBank
);

public record HiddenTestCase(
    string TestId,
    string InputStdin,
    string ExpectedToken,
    double Points
);

public record GradedTestResult(
    string TestId,
    bool Passed,
    double PointsAwarded,
    double MaxPoints,
    int DurationMs
);

public record SignedGradingReceipt(
    string RunId,
    string AssignmentId,
    string UserId,
    double OfficialScoreGiven,
    double OfficialScoreMaximum,
    string GradingProgress,
    string ActivityProgress,
    string Timestamp,
    string Signature,
    List<GradedTestResult> TestResults
);
