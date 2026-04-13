"""Backend proxy for the PBI Agent Chat widget.

Validates requests, enforces rate limits, and forwards messages
to the Google Agent Engine hosted agent.  No Google credentials
are ever exposed to the client.
"""

import functions_framework
import os
import json
import logging
import hmac
import time
import re
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Configuration (all from environment variables) ─────────────────────────
AGENT_RESOURCE = os.environ.get("AGENT_ENGINE_RESOURCE", "")
REGION = os.environ.get("GCP_REGION", "us-central1")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
MAX_MESSAGE_LENGTH = int(os.environ.get("MAX_MESSAGE_LENGTH", "4000"))

# ── In-memory rate limiting (resets on cold start — fine for v1) ───────────
RATE_LIMIT_RPM = int(os.environ.get("RATE_LIMIT_RPM", "30"))
_rate_store: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_id: str) -> bool:
    """Sliding-window rate limiter: max RATE_LIMIT_RPM requests per 60 s."""
    now = time.time()
    window = _rate_store[client_id]
    _rate_store[client_id] = [t for t in window if now - t < 60]
    if len(_rate_store[client_id]) >= RATE_LIMIT_RPM:
        return False
    _rate_store[client_id].append(now)
    return True


def _validate_api_key(provided: str) -> bool:
    """Timing-safe comparison against the configured API key."""
    expected = os.environ.get("ALLOWED_API_KEY", "")
    if not expected or not provided:
        return False
    return hmac.compare_digest(provided.encode(), expected.encode())


def _sanitize(value: str, max_len: int = 128) -> str:
    """Strip, truncate, and remove control characters."""
    if not isinstance(value, str):
        return ""
    value = value.strip()[:max_len]
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value)


def _cors(body, status, content_type="application/json"):
    """Attach CORS headers to every response."""
    headers = {
        "Content-Type": content_type,
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
        "Access-Control-Max-Age": "3600",
    }
    return (body, status, headers)


@functions_framework.http
def chat(request):
    """Cloud Function entry point — proxy to Agent Engine."""

    # ── CORS preflight ─────────────────────────────────────────────────────
    if request.method == "OPTIONS":
        return _cors("", 204)

    if request.method != "POST":
        return _cors('{"error":"Method not allowed"}', 405)

    # ── Auth (timing-safe) ─────────────────────────────────────────────────
    if not _validate_api_key(request.headers.get("X-API-Key", "")):
        return _cors('{"error":"Unauthorized"}', 401)

    # ── Rate limit ─────────────────────────────────────────────────────────
    client_ip = request.headers.get(
        "X-Forwarded-For", request.remote_addr or "unknown"
    ).split(",")[0].strip()
    if not _check_rate_limit(client_ip):
        return _cors('{"error":"Rate limit exceeded. Try again later."}', 429)

    # ── Parse body ─────────────────────────────────────────────────────────
    try:
        body = request.get_json(silent=True) or {}
    except Exception:
        return _cors('{"error":"Invalid JSON"}', 400)

    message = body.get("message", "")
    user_id = _sanitize(body.get("user_id", "default-user"))
    session_id = _sanitize(body.get("session_id", ""))

    if not message or not isinstance(message, str):
        return _cors('{"error":"message is required"}', 400)

    if len(message) > MAX_MESSAGE_LENGTH:
        return _cors(
            json.dumps({"error": f"message exceeds {MAX_MESSAGE_LENGTH} chars"}), 400
        )

    if not AGENT_RESOURCE:
        logger.error("AGENT_ENGINE_RESOURCE not configured")
        return _cors('{"error":"Backend misconfiguration"}', 500)

    # ── Call Agent Engine ──────────────────────────────────────────────────
    try:
        from google.cloud import aiplatform_v1
        from google.protobuf import struct_pb2

        client = aiplatform_v1.ReasoningEngineExecutionServiceClient(
            client_options={
                "api_endpoint": f"{REGION}-aiplatform.googleapis.com"
            }
        )

        # ── Step 1: Ensure we have a session_id ───────────────────────────
        # If the client didn't send one, create a new session via the
        # agent's create_session class method.
        if not session_id:
            create_req = aiplatform_v1.QueryReasoningEngineRequest(
                name=AGENT_RESOURCE,
                input={"user_id": user_id},
                class_method="create_session",
            )
            create_resp = client.query_reasoning_engine(create_req)
            # The response is a google.protobuf.Value; extract session_id
            resp_str = str(create_resp)
            logger.info("create_session response: %s", resp_str)

            # Try to extract from the structured response
            try:
                if hasattr(create_resp, "output"):
                    output = create_resp.output
                    # It could be a Struct or string value
                    if hasattr(output, "string_value") and output.string_value:
                        session_id = output.string_value
                    elif hasattr(output, "struct_value"):
                        s = dict(output.struct_value.fields)
                        if "id" in s:
                            session_id = s["id"].string_value
                        elif "session_id" in s:
                            session_id = s["session_id"].string_value
            except Exception as e:
                logger.warning("Could not parse create_session response: %s", e)

            # Fallback: try to find session ID via regex in the response string
            if not session_id:
                import re as _re
                match = _re.search(r"['\"]?(?:id|session_id)['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]", resp_str)
                if match:
                    session_id = match.group(1)

            logger.info("Session ID resolved: %s", session_id or "(none)")

        # ── Step 2: Query with session_id ─────────────────────────────────
        agent_input: dict = {
            "message": message,
            "user_id": user_id,
        }
        if session_id:
            agent_input["session_id"] = session_id

        ae_request = aiplatform_v1.StreamQueryReasoningEngineRequest(
            name=AGENT_RESOURCE,
            input=agent_input,
            class_method="async_stream_query",
        )

        response = client.stream_query_reasoning_engine(ae_request)

        # ── Step 3: Parse streamed chunks ─────────────────────────────────
        last_model_text: str = ""

        for chunk in response:
            raw = None
            try:
                raw = chunk.data.decode("utf-8") if chunk.data else None
            except Exception:
                raw = str(chunk.data) if chunk.data else None

            if not raw:
                continue
            try:
                data = json.loads(raw)

                # Skip chunks without model content
                content = data.get("content")
                if not content or not isinstance(content, dict):
                    continue

                parts = content.get("parts", [])
                text_parts = [p["text"] for p in parts if "text" in p]
                if not text_parts:
                    continue

                combined = "".join(text_parts).strip()
                is_json_block = (
                    combined.startswith("{") and combined.endswith("}")
                )

                if not is_json_block:
                    last_model_text = combined

            except (json.JSONDecodeError, UnicodeDecodeError, KeyError):
                continue

        logger.info(
            "Agent replied %d chars, session=%s",
            len(last_model_text),
            session_id or "(none)",
        )
        return _cors(
            json.dumps({
                "text": last_model_text,
                "session_id": session_id,
            }),
            200,
        )

    except Exception as exc:
        logger.error("Agent Engine error: %s", exc)
        return _cors(
            json.dumps({"error": "Agent communication failed. Please try again."}),
            502,
        )
