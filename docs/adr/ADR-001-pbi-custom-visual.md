# ADR-001: Power BI Custom Visual as the Embed Mechanism

**Status:** Accepted
**Date:** 2026-04-01

---

## Context

We need to expose a Vertex AI Agent Engine chat agent to users viewing a Power BI dashboard. The agent must appear as a live, interactive chat widget embedded directly in the dashboard canvas — not as a link to an external page, not as a screenshot, not as a pinned tile.

Power BI has three content surfaces:

| Surface | Supports custom web content? | Supports external API calls? |
|---|---|---|
| Dashboards | No — tiles and KPIs only | No |
| Reports | Yes — but only for Power BI reports via secure embed | N/A |
| Custom Visuals | Yes — React app inside sandboxed iframe | Yes — via `WebAccess` privilege |

Power BI dashboards explicitly prohibit arbitrary `iframe` embeds. The only mechanism for rendering a custom chat interface inside a dashboard canvas is a **Power BI Custom Visual** — a packaged React application with a `.pbiviz` extension, imported directly into Power BI Desktop or the Power BI service.

The alternative of opening the agent in a new browser tab is not acceptable to the customer — the experience must be seamless and in-context within the dashboard.

---

## Decision

We will build a Power BI Custom Visual using React 18, TypeScript, and the `powerbi-visuals-tools` toolchain (`pbiviz`). The visual is distributed as a `.pbiviz` file uploaded to the Power BI organisational store.

The visual runs inside a sandboxed iframe inside the Power BI canvas. It communicates with the backend via HTTPS, passing a static API key in the `X-API-Key` header. Outbound HTTPS calls require the `WebAccess` privilege to be declared in `capabilities.json`.

---

## Alternatives Considered

**Embedding via iframe in a report page (not a dashboard):** Reports can embed external URLs via the "Embed > Website or portal" option, but this requires the report page to be in "edit" mode and is not available on dashboard surfaces.

**SharePoint page embedding the visual:** A SharePoint page could host the React chat app independently of Power BI. This was rejected because the requirement is specifically to surface the agent inside an existing Power BI dashboard, not to create a separate destination.

**Certified AppSource visual:** Submitting the visual to AppSource would make it publicly available and would require passing Microsoft's certification checks, which explicitly forbid outbound network calls (`WebAccess`). Organisational distribution avoids this requirement entirely.

---

## Consequences

**Positive:**
- The only supported path for embedding custom web content inside a Power BI dashboard canvas.
- Full control over the React UI — no third-party widget constraints.
- Same codebase can also be deployed as a standalone web app (separate build).

**Negative (Trade-offs):**
- The `pbiviz` toolchain requires Node.js 20+ and the `powerbi-visuals-tools` package. The development workflow differs from standard React development — hot reload only works inside Power BI Desktop.
- `fetch` calls from inside the visual require `WebAccess` privilege declaration in `capabilities.json`. This is organisational-only; certified AppSource visuals cannot use it.
- Distribution requires a Power BI admin to upload the `.pbiviz` to the organisational store. End users cannot self-serve from AppSource.
- Power BI enforces a sandbox that blocks `eval`, `new Function`, direct cookies, and WebSockets. The visual must work within these constraints.
