#!/usr/bin/env bash
# deploy-function.sh
# Builds and deploys the Cloud Function to GCP.
# Usage: ./scripts/deploy-function.sh <project> <region>
set -euo pipefail

PROJECT="${1:?Usage: $0 <project> <region>}"
REGION="${2:-us-central1}"
FUNCTION_NAME="pbi-agent-chat"
DEPLOYMENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/deployment"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../app/backend" && pwd)"

echo "=== Building Cloud Function deployment package ==="
mkdir -p "${DEPLOYMENT_DIR}"
zip -r "${DEPLOYMENT_DIR}/function.zip" \
  -j "${SRC_DIR}/main.py" \
  "${SRC_DIR}/requirements.txt" \
  --exclude "*.pyc" \
  --exclude "__pycache__/*"

echo "=== Deploying to Cloud Functions ==="
gcloud functions deploy "${FUNCTION_NAME}" \
  --project "${PROJECT}" \
  --region "${REGION}" \
  --runtime python313 \
  --entry-point chat \
  --source "${DEPLOYMENT_DIR}/function.zip" \
  --trigger-http \
  --allow-unauthenticated \
  --region "${REGION}" \
  --memory 256M \
  --timeout 60s \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars AGENT_ENGINE_RESOURCE="${AGENT_ENGINE_RESOURCE:-}" \
  --set-secrets ALLOWED_API_KEY=pbi-agent-chat-api-key:latest

echo "=== Done ==="
gcloud functions describe "${FUNCTION_NAME}" --project "${PROJECT}" --region "${REGION}" \
  --format "value(httpsTrigger.url)"
