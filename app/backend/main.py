import functions_framework
import os
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

AGENT_RESOURCE = os.environ.get("AGENT_ENGINE_RESOURCE", "")
PROJECT = os.environ.get("GCP_PROJECT", "shared-infrastructure-213903")
REGION = os.environ.get("GCP_REGION", "us-central1")

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")


def add_cors_headers(response_body, status_code, content_type="application/json"):
    """Add CORS headers to response."""
    headers = {
        "Content-Type": content_type,
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
        "Access-Control-Max-Age": "3600",
    }
    return (response_body, status_code, headers)


@functions_framework.http
def chat(request):
    """
    Cloud Functions Gen 2 HTTP entry point.

    Validates X-API-Key, proxies to Vertex AI Agent Engine via the
    gRPC streaming API, and returns the buffered JSON response.

    Request:  POST JSON { message, user_id? }
    Response: JSON { text: str }
    """
    if request.method == "OPTIONS":
        return add_cors_headers("", 204)

    api_key = request.headers.get("X-API-Key", "")
    allowed = os.environ.get("ALLOWED_API_KEY", "")
    if not api_key or api_key != allowed:
        return add_cors_headers('{"error": "Unauthorized"}', 401)

    try:
        body = request.get_json(silent=True) or {}
    except Exception:
        return add_cors_headers('{"error": "Bad Request: invalid JSON"}', 400)

    message = body.get("message", "")
    user_id = body.get("user_id", "default-user")

    if not message:
        return add_cors_headers('{"error": "message is required"}', 400)

    if not AGENT_RESOURCE:
        return add_cors_headers('{"error": "AGENT_ENGINE_RESOURCE not set"}', 500)

    try:
        from google.cloud import aiplatform_v1

        client = aiplatform_v1.ReasoningEngineExecutionServiceClient(
            client_options={"api_endpoint": f"{REGION}-aiplatform.googleapis.com"}
        )
        request = aiplatform_v1.StreamQueryReasoningEngineRequest(
            name=AGENT_RESOURCE,
            input={"message": message, "user_id": user_id},
            class_method="stream_query",
        )

        response = client.stream_query_reasoning_engine(request)
        texts = []
        for chunk in response:
            if not chunk.data:
                continue
            try:
                data = json.loads(chunk.data.decode("utf-8"))
                content = data.get("content", {})
                parts = content.get("parts", [])
                for part in parts:
                    if "text" in part:
                        texts.append(part["text"])
            except (json.JSONDecodeError, UnicodeDecodeError, KeyError):
                continue

        full_text = "".join(texts)
        logger.info("Agent returned %d chars", len(full_text))
        return add_cors_headers(json.dumps({"text": full_text}), 200)

    except Exception as exc:
        logger.error("Agent engine call failed: %s", exc)
        return add_cors_headers(json.dumps({"error": str(exc)}), 502)
