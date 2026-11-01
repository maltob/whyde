# Security Audit: LTI 1.3 Gateway & LMS Boundary

## Executive Summary
This audit reviews the LTI 1.3 gateway implementation against Specification Section 11 (Optional Canvas LTI 1.3 Integration) and Section 12 (Threat Model, Security, and Privacy).

While the skeleton fulfills the structural endpoint contracts required by M8, deploying this service to a production environment requires addressing critical security boundaries and vulnerabilities.

---

## 1. Vulnerability Findings & Risk Analysis

### SEC-LTI-001: Open Redirect / SSRF on Login Initiation (`/lti/login`)
- **Severity**: **Critical**
- **Location**: `Program.cs` line 91
- **Code**:
  ```csharp
  var authRedirectUrl = $"{iss}/api/lti/authorize_redirect?...";
  return Results.Redirect(authRedirectUrl);
  ```
- **Risk**: The `iss` (issuer) query parameter is accepted unvalidated from user input. An attacker can craft a phishing link or trigger server redirects to internal infrastructure or arbitrary malicious domains.
- **Required Mitigation**: Maintain an **allowlist of registered Canvas platform issuers** (e.g. `https://canvas.instructure.com`, institutional domains). Reject any `iss` not explicitly pre-configured by the institution.

---

### SEC-LTI-002: Overly Permissive CORS with Credentials
- **Severity**: **High**
- **Location**: `Program.cs` lines 9–15
- **Code**:
  ```csharp
  .AllowCredentials()
  .SetIsOriginAllowed(origin => true);
  ```
- **Risk**: Allowing all origins while enabling credentials (`AllowCredentials()`) completely defeats Cross-Origin Resource Sharing restrictions. Any malicious site loaded in the user's browser could make authenticated requests to `/api/session/context` or post unauthorized grades.
- **Required Mitigation**: Restrict `SetIsOriginAllowed` strictly to the approved static IDE domain (e.g. `https://your-campus.github.io` or configured institution origin).

---

### SEC-LTI-003: Missing Cryptographic JWT Signature & Claim Verification (`/lti/launch`)
- **Severity**: **Critical**
- **Location**: `Program.cs` lines 100–121
- **Code**: Currently validates non-emptiness of `id_token` without verifying cryptographic signature against Canvas JWKS.
- **Risk**: An attacker can fabricate arbitrary JWT payloads with spoofed `sub` (userId) and `roles` (Instructor), gaining unauthorized access or submitting grades on behalf of other students.
- **Required Mitigation**:
  1. Fetch and cache Canvas's public keys from Canvas JWKS endpoint.
  2. Verify RSA signature (`RS256`).
  3. Validate `aud` matches registered Client ID.
  4. Validate `nonce` matches the exact one-time nonce stored during `/lti/login`.
  5. Verify token expiration (`exp`) and not-before (`nbf`) timestamps.

---

### SEC-LTI-004: In-Memory Nonce Storage & Replay Protection
- **Severity**: **Medium**
- **Location**: `Program.cs` line 23
- **Code**:
  ```csharp
  var nonces = new HashSet<string>();
  ```
- **Risk**:
  1. Multi-instance / serverless deployments will not share memory, allowing replay attacks across pods.
  2. The `HashSet` lacks a Time-To-Live (TTL) eviction strategy, which causes unbounded memory consumption over time.
- **Required Mitigation**: Use a distributed cache (e.g., Redis or database with TTL) for single-use nonce validation, or use signed short-lived state tokens.

---

### SEC-LTI-005: Unauthenticated Grade Submission (`/api/assignments/{resourceId}/submissions`)
- **Severity**: **Critical**
- **Location**: `Program.cs` lines 138–157
- **Risk**: The endpoint currently accepts grade submissions without verifying the caller's session cookie or checking whether the user possesses the `Instructor` or authorized grading role.
- **Required Mitigation**:
  1. Require an authenticated `HttpOnly`, `SameSite=None`, `Secure` session cookie.
  2. Verify the student's submission matches the assigned user ID.
  3. Per Specification Section 11.3: For summative assessments, only the **Trusted Grader** or verified instructor review should trigger official AGS grade posting; raw browser-submitted scores must remain flagged as untrusted unless an institutional policy specifically permits completion credit.

---

## 2. Hardening Action Plan

1. **Issuer Allowlist Configuration**: Add `AllowedIssuers` list to `appsettings.json`.
2. **Strict Origin Policy**: Bind CORS exclusively to the production IDE static host.
3. **IdentityModel JWT Validation**: Integrate `Microsoft.IdentityModel.Protocols.OpenIdConnect` to parse and cryptographically verify Canvas ID tokens.
4. **Session Binding**: Generate cryptographic session tokens tied to `userId` and `lineItemUrl`.
