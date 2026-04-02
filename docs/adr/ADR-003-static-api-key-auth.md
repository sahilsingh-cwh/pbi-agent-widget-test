# ADR-003: Static API Key Authentication

**Status:** Accepted
**Date:** 2026-04-01

---

## Context

We cannot create an Entra App registration in the customer's Microsoft 365 tenant, and Workforce Identity Federation (WIF) between M365 and Google Cloud is not available in the near term. Without either of these, we cannot authenticate individual M365 users to GCP using their corporate credentials.

The customer's requirement for v1 is to expose the agent to anyone who can view the Power BI dashboard. The Power BI dashboard itself is Entra ID-backed, and access control on the dashboard determines who can interact with the widget. Per-user audit — tracing chat messages back to individual M365 users — is a desired future capability, not a v1 requirement.

---

## Decision

A **static API key** is embedded in the Power BI Custom Visual (via the format pane) and sent as the `X-API-Key` HTTP header to the Cloud Function on every request. The Cloud Function validates the key against the value stored in **Secret Manager**, which the Terraform configuration provisions and manages.

The key is a secret — it is stored in Secret Manager, never in source control or the widget's compiled code. Terraform can store it in state, which should be treated as sensitive and backed by a GCS remote state bucket with version control and access logging.

The Power BI dashboard visibility boundary is the effective authentication boundary. Anyone who can view the dashboard has access to the API key.

---

## Alternatives Considered

**Firebase Auth with Entra OIDC:** Firebase Auth natively supports Microsoft as an OIDC identity provider. Users would sign in with their M365 credentials and the widget would send a Firebase JWT to the Cloud Function. This provides per-user identity without WIF. Rejected because configuring Firebase Auth with Entra requires creating an Entra App registration — the core constraint that blocks v1.

**Supabase Auth with Entra OIDC:** Same constraint — requires Entra App registration.

**Google IAP (Identity-Aware Proxy):** IAP enforces IAM-based access to the Cloud Function, authenticating users via their Google identity. It does not support API key validation — only Google accounts and service accounts. Without WIF, M365 users cannot authenticate to IAP.

**Service account key JSON distributed to the widget:** The widget would use a Google service account private key to obtain an OAuth token directly. This is the correct long-term pattern but requires managing and rotating a service account key. Rejected because the security blast radius of a leaked service account key is significantly larger than a scoped static API key.

---

## Consequences

**Positive:**
- No new identity provider setup required. Works immediately in any tenant.
- Simple to understand, simple to audit in logs (every request shows the same key).
- Easy to rotate — add a new Secret Manager version, update the format pane.

**Negative (Trade-offs):**
- **No per-user audit trail.** Every chat message in Vertex AI and Cloud Logging appears to originate from the same service account identity. If two users have a conversation that produces a harmful output, there is no way to attribute it to one user or the other.
- **API key in the widget format pane.** Anyone who can view the dashboard can extract the key from the network traffic or by inspecting the visual's dataView. For an internal BI dashboard this is an acceptable risk. For a customer-facing or public dashboard it is not.
- **Key rotation requires format pane update.** Power BI report authors must update the key field in the visual's format pane after rotation. There is no automatic propagation mechanism.

**Future migration path:** When Entra App registration becomes available, replace the static API key with Firebase Auth (M365 OIDC) and issue per-user JWTs. The Cloud Function's request-handling signature is the same — only the validation logic changes.
