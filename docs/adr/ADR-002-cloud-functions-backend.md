# ADR-002: Cloud Functions Gen 2 as the Backend Proxy

**Status:** Accepted
**Date:** 2026-04-01

---

## Context

Vertex AI Agent Engine has no API key authentication, no CORS headers for browser requests, and requires all callers to authenticate via IAM (OAuth 2.0 / service account tokens). A browser-based Power BI Custom Visual cannot:

1. Obtain a valid OAuth token for a Google service account without significant credential management complexity.
2. Make direct REST calls to the Agent Engine API due to missing CORS headers.
3. Store or use long-lived service account keys safely in client-side code.

A server-side proxy is required to bridge the visual's simple API-key-based request to the IAM-authenticated Vertex AI API call.

---

## Decision

**Cloud Functions Gen 2** (Python 3.13 runtime) acts as the proxy. It receives HTTPS requests from the widget, validates the `X-API-Key` header, obtains a short-lived Vertex AI token via Application Default Credentials (ADC) using the attached service account, and forwards the request to the Agent Engine `streamQuery` endpoint.

The function is deployed via the Cloud Foundation Fabric `modules/cloud-function-v2` module. It has no service account keys stored in code or environment — ADC resolves credentials from the attached service account automatically.

Key properties:
- Entry point: `chat` (Python function decorated with `@functions_framework.http`)
- Runtime: Python 3.13
- Memory: 256 MB
- Timeout: 60 seconds
- Scaling: 0 to 10 instances (pay-per-use; cold start ~1 s)

---

## Alternatives Considered

**Cloud Run (container):** Cloud Run can serve both the API and a static React frontend from a single container. This is the right choice if true streaming is required or if a standalone web deployment is needed alongside the Power BI visual. It was rejected for v1 because it introduces Docker build complexity and a container registry. A future migration to Cloud Run is planned to enable streaming responses.

**API Gateway + Cloud Functions:** An API Gateway adds a managed HTTPS proxy layer in front of Cloud Functions with built-in API key validation, request logging, and quota management. It adds cost (~$0.40/M invocations plus gateway management fees) and configuration complexity. The API key validation logic is simple enough to implement inside the function itself.

**App Engine Standard:** App Engine Standard offers a managed Python runtime without containers. It is effectively deprecated for new workloads — Cloud Run is the successor. It does not support the Gen 2 Functions framework's improvements.

**Direct service account key in the widget:** Storing a service account private key JSON file in the widget or passing it from the visual was rejected on security grounds — it would allow any user with the visual to impersonate the service account indefinitely.

---

## Consequences

**Positive:**
- No credentials in code or environment variables. ADC handles token refresh automatically.
- Genuinely minimal infrastructure — one function, no containers, no gateway.
- Terraform deploys the function directly from `app/backend/` — no manual zip step.
- Cold start of ~1 s is acceptable for a dashboard widget use case.

**Negative (Trade-offs):**
- **Buffered responses only.** Cloud Functions Gen 2 (built on Cloud Run) does not natively support HTTP streaming responses via the Functions Framework. The full response is collected before being returned to the caller. For true streaming (tokens arriving incrementally in the UI), a migration to Cloud Run with a custom streaming handler is required.
- **Vendor lock-in to Cloud Functions.** If Google deprecates the Functions Framework, migration effort is needed. This is low risk given Google's track record of providing long deprecation windows.
- **Cold starts.** With `min_instances = 0`, the first request after idle may take ~1–2 s. Setting `min_instances = 1` eliminates cold starts at added cost (always one warm instance).
