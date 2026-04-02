# Customer Brief — Vertex AI Agent Engine Widget for Power BI

**Date:** 1 April 2026
**Classification:** Client-Confidential

---

## What this is

A packaged solution that lets your users chat with your Vertex AI Agent Engine agent directly from inside a Power BI dashboard — without switching tabs, opening a new browser window, or leaving the report they are already viewing.

The agent appears as an interactive chat widget embedded in the dashboard canvas. Anyone who has access to the dashboard can use it.

---

## How it works

```
Power BI Dashboard
        │
        ▼  (user types a message)
┌───────────────────────────────┐
│  Chat Widget                  │
│  (Custom Visual — .pbiviz)   │
│  React app inside Power BI    │
└──────────┬────────────────────┘
           │  HTTPS + API key
           ▼
┌───────────────────────────────┐
│  Cloud Function               │
│  (Python, on Google Cloud)    │
│  • Checks the API key         │
│  • Gets a Vertex AI token    │
│  • Calls your agent          │
└──────────┬────────────────────┘
           │  IAM (service account)
           ▼
┌───────────────────────────────┐
│  Vertex AI Agent Engine      │
│  (your Gemini Enterprise     │
│   agent — already deployed)  │
└───────────────────────────────┘
```

**No credentials on the user's machine.** The Cloud Function uses Google's Application Default Credentials — a service account attached to the function that has permission to call your Agent Engine. Your users never see or handle any Google or Microsoft credentials.

---

## What was decided and why

| Decision | Why |
|---|---|
| **Power BI Custom Visual** (not an iframe link) | Power BI dashboards don't support iframes. A Custom Visual is the only way to embed a live chat interface inside the dashboard canvas. |
| **Cloud Functions as the proxy** | One Python function, no containers, no API gateway. Google handles scaling from zero to thousands of concurrent dashboard viewers. |
| **Static API key** (not Entra / SSO) | We cannot create an Entra App registration in your tenant today. The Power BI dashboard's access control is the effective auth boundary — anyone who can see the dashboard can use the widget. Per-user audit is planned as a future step when that constraint is lifted. |
| **@assistant-ui/react** for the chat UI | The most production-ready open-source chat UI built specifically for LLM streaming. MIT licensed, actively maintained, and compatible with the Vercel AI SDK. |

---

## What you need from your side

1. **A GCP project** with billing enabled, where the Cloud Function and its associated resources (GCS bucket, Secret Manager, service account) will live. This can be the same project where your Agent Engine is deployed, or a separate one.

2. **The full resource name of your Agent Engine agent**, in the format `projects/P/locations/REGION/reasoningEngines/ID`. This is shown in the Vertex AI Console when you open the agent.

3. **A secure random string** for the API key — we will generate this together. It is stored in Google Secret Manager and never in source control.

4. **Power BI Pro or Premium** per user for the report authors. Dashboard viewers need at least a Pro license to interact with the visual. Your Power BI admin will need to upload the `.pbiviz` file to the organisational store.

5. **A Power BI admin** to approve and distribute the visual through your tenant's Power BI organisational store.

---

## What's in the box

| Deliverable | Location |
|---|---|
| Terraform (Cloud Function, IAM, secrets, GCS) | `terraform/` |
| Python Cloud Function | `app/backend/main.py` |
| React Power BI Custom Visual scaffold | `app/widget/` |
| Architecture decisions and rationale | `docs/adr/` |
| Developer guide | `docs/developer-guide.md` |
| Operator / SRE runbook | `docs/operator-guide.md` |
| Roadmap | `docs/roadmap/README.md` |

---

## What it will look like for your users

Report consumers open a Power BI dashboard. In the Visualisations pane they select **Agent Chat**. In the format pane they paste the Cloud Function URL and the API key (once, by the report author). The widget appears in the report canvas and they can type messages and receive streamed responses from the agent.

There is no separate login. There is no new URL to navigate to.

---

## Limitations to know about

**Per-user audit is not available yet.** All messages appear to come from the same service account. If attributing conversations to individual users is a compliance requirement, this needs to be addressed before go-live — it requires Entra App registration which we will revisit.

**Streaming is buffered, not real-time.** Tokens arrive in batches (~1–2 second chunks) rather than character-by-character. For a dashboard analytics use case this is acceptable. True real-time streaming requires a Cloud Run migration which is in the roadmap.

**API key is in the format pane.** Anyone who can open the report in edit mode can see the API key in the format pane. For an internal BI dashboard this is standard practice. If the dashboard is broadly shared externally, this needs to be reconsidered.

---

## Timeline

| Milestone | Week |
|---|---|
| End-to-end smoke test (function deployed, widget renders) | 2 |
| Production-quality widget (branded, error handling, loading states) | 3–4 |
| Organisational distribution (admin uploads to Power BI store) | 5 |
| Monitoring and SRE handover | 6 |

---

## Next steps

1. Confirm the GCP project to use (or let us know if a new one should be created).
2. Provide the Agent Engine resource name.
3. Confirm the Power BI admin contact for organisational store distribution.
4. We will then run `terraform apply`, build the `.pbiviz`, and hand both over with runbooks and developer documentation.
