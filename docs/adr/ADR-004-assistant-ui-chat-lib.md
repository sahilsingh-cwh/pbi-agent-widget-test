# ADR-004: @assistant-ui/react for the Chat UI

**Status:** Accepted
**Date:** 2026-04-01

---

## Context

We need a production-ready React chat UI component library to embed in the Power BI Custom Visual. The library must:

- Be MIT-licensed for commercial use.
- Work with the Vercel AI SDK's `useChat` hook (the community standard for React + streaming LLM interfaces).
- Support streaming responses (Server-Side Events / SSE) so tokens arrive incrementally in the UI.
- Bundle into a webpack-compiled `.pbiviz` file (no Node.js built-ins, no server-only packages).
- Provide composable UI primitives so the visual is customisable without a full redesign.

No existing Power BI Custom Visual or Microsoft-owned component library meets these requirements. We evaluated the open-source ecosystem before deciding to build.

---

## Decision

**`@assistant-ui/react`** (MIT, 9.1k GitHub stars) as the UI component library, supplemented by **`@assistant-ui/react-ai-sdk`** for the Vercel AI SDK integration.

The `useChatRuntime(useChat)` bridge from `@assistant-ui/react-ai-sdk` connects the visual's `fetch` call to the `@assistant-ui/react` component tree automatically, handling streaming state, message appending, loading indicators, and markdown rendering without additional application code.

The component tree used in this project:
- `Thread` — scrollable message list container
- `UserMessage` / `AssistantMessage` — message bubble primitives
- `LoadingIndicator` — shown while the agent is streaming a response
- `MessageInput` — text input with send button

---

## Alternatives Considered

**@chatscope/chat-ui-kit-react:** A general-purpose messenger UI kit (MIT, 1.7k stars). Rejected because its companion state management hook (`@chatscope/use-chat`) has not been updated since September 2023, is designed for real-time multi-user messaging rather than AI streaming, and does not integrate with the Vercel AI SDK.

**Vercel AI SDK built-in primitives (`@ai-sdk/react`):** The SDK ships minimal `<Message>` and `<ChatInput>` components. These are suitable for prototypes but not production interfaces — they have no loading skeleton, no markdown rendering, no scroll management, and no customisation API.

**stream-chat-react:** A full-featured chat SDK (840k weekly npm downloads) backed by the Stream service. Rejected because it requires a Stream backend account and is architecturally designed for multi-user real-time messaging, not a stateless proxy to a single LLM agent.

**Building from scratch:** Writing a full chat UI (streaming, markdown, error states, loading indicators, scroll management) is significant effort — typically 2–3 weeks of engineering. `@assistant-ui/react` is production-grade, actively maintained (119 contributors, 1,250 releases), and purpose-built for exactly this use case.

---

## Consequences

**Positive:**
- Near-zero UI code to write. The `Thread` + `useChatRuntime` pattern is the entire widget UI.
- Native streaming support via the `useChatRuntime` bridge — no manual SSE parsing.
- Markdown rendering (tables, code blocks, bold/italic) handled by `@assistant-ui/react` out of the box.
- Radix-style composability means individual components can be swapped or restyled without replacing the entire UI.

**Negative (Trade-offs):**
- **Dependency on a VC-backed startup.** `@assistant-ui/react` is maintained by a Y Combinator-backed company. If the project is abandoned, the widget UI becomes a maintenance burden. Mitigation: the components are MIT-licensed — the team can fork and maintain independently if needed.
- **Two-package dependency.** The pattern requires both `@assistant-ui/react` and `@assistant-ui/react-ai-sdk`. If either has a breaking change on upgrade, the widget requires a patch release.
- **Customisation is CSS-variable-based.** Deep customisation (e.g., replacing the message bubble with a completely different layout) requires understanding the component's internal slot API.
