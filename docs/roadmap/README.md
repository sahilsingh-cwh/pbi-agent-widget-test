# Roadmap

**Last updated:** 2026-04-01

---

## Milestone 1 — End-to-End Smoke Test
**Target:** Week 2
**Definition of Done:** A user can open the Power BI dashboard, type a message in the widget, and receive a response from the Vertex AI Agent Engine.

- [ ] `terraform/terraform.tfvars` populated with real project, region, and agent engine resource name
- [ ] `terraform apply` succeeds — Cloud Function is `ACTIVE`
- [ ] Smoke test: `curl` to function URL returns 200 with agent response
- [ ] `pbiviz package` produces a valid `.pbiviz` file
- [ ] `.pbiviz` imported into Power BI Desktop — visual renders without errors
- [ ] First chat message in the visual produces a streaming response from the agent

---

## Milestone 2 — Production-Quality Widget
**Target:** Week 3–4
**Definition of Done:** The widget is usable by non-technical report consumers with appropriate error handling, loading states, and styling that matches customer brand guidelines.

- [ ] `ChatThread.tsx` — `useChatRuntime` correctly wired to backend URL and `X-API-Key` from format pane
- [ ] Streaming: responses render incrementally, not buffered until complete
- [ ] Error state: user-friendly message when API key is wrong or function is unreachable
- [ ] Loading state: typing indicator shown while agent is responding
- [ ] Scroll-to-bottom: new messages automatically scroll the message list into view
- [ ] Session preservation: conversation context is maintained within a single dashboard session
- [ ] Format pane: endpoint URL and API key are configurable by report authors (no code deploy required to change these)
- [ ] Customer branding: colour tokens, font, and widget dimensions match corporate guidelines

---

## Milestone 3 — Organisational Distribution
**Target:** Week 5
**Definition of Done:** The `.pbiviz` is deployed to the Power BI organisational store and available to all licensed Power BI users in the tenant.

- [ ] `.pbiviz` signed with organisational certificate (if tenant policy requires)
- [ ] Power BI admin uploads to organisational store
- [ ] Documentation for Power BI admins: importing and distributing the visual
- [ ] Documentation for report authors: configuring the visual in a report
- [ ] API key rotation procedure documented in `docs/operator-guide.md`

---

## Milestone 4 — Observability
**Target:** Week 6
**Definition of Done:** The SRE team has monitoring dashboards and alerting in place before the widget goes live to the full user base.

- [ ] Cloud Logging: structured JSON logs for all function invocations (severity, latency_ms, vertex_status)
- [ ] Cloud Monitoring: dashboard — invocation count, error rate, p99 latency (24h window)
- [ ] Alerting policy: email/pagerduty notification when error rate exceeds 1% over a 5-minute window
- [ ] Runbook: `docs/operator-guide.md` completed with deployment, rollback, and incident response procedures

---

## Milestone 5 — Per-User Audit (Future)
**Status:** Blocked — requires Entra App registration
**Definition of Done:** Every chat message in logs and Vertex AI is attributable to a specific M365 user identity.

This milestone is parked until the customer can create an Entra App registration or WIF becomes available.

Migration path:
1. Replace static `X-API-Key` auth with Firebase Auth + M365 OIDC identity provider
2. Cloud Function validates Firebase JWT instead of the static key
3. User ID (Firebase UID) is logged alongside every Vertex AI request
4. Power BI visual reads the Firebase token from the user's session and sends it as a Bearer token

Architecture change only — the Agent Engine endpoint and request shape remain identical.

---

## Milestone 6 — Streaming via Cloud Run (Future)
**Status:** Backlog
**Definition of Done:** Token stream from the agent renders in the widget in real time, not after the full response completes.

Cloud Functions Gen 2 via the Functions Framework does not support true HTTP streaming. Migrating to Cloud Run with a FastAPI `StreamingResponse` enables SSE, so the visual receives tokens as they are generated.

The Terraform migration is: replace `modules/cloud-function-v2` with a Cloud Run service (CFF `modules/cloud-run` or native resource). The Python function signature and the widget's `fetch` call remain unchanged.

---

## Milestone 7 — Multi-Agent Routing (Future)
**Status:** Backlog
**Definition of Done:** A single widget can route to different Agent Engine resources based on report or user context.

Implementation: add a `route_key` to the Cloud Function's request body and the Terraform variable `agent_engine_resources` (a map of route key → resource name). The function dispatches to the appropriate agent based on the key. The format pane exposes a dropdown to select the agent.
