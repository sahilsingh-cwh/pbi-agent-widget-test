# Operator Guide

**Audience:** Site Reliability Engineers and Platform teams responsible for running this system in production.

---

## System overview

```
Power BI Dashboard
        │
        ▼  HTTPS + X-API-Key
Cloud Functions Gen 2  (pbi-agent-chat)
        │
        ▼  Bearer token (ADC)
Vertex AI Agent Engine
```

**Uptime dependency:** The widget is unavailable if the Cloud Function is unavailable. The Vertex AI Agent Engine must also be running. There is no caching or fallback layer in v1.

---

## Prerequisites

You need the following before running any procedure in this guide.

**Required access:**
- `roles/owner` on the GCP project, or sufficient permissions to manage Cloud Functions, Secret Manager, IAM, and Service Accounts
- Access to the organisation's Power BI admin portal

**Required tools:**
- `gcloud` CLI, authenticated and targeting the correct project
- `terraform` ≥ 1.10
- `jq` (for log parsing in incident response)

**System state:**
- Vertex AI Agent Engine resource is deployed and healthy
- Terraform state is up to date (check `terraform show` before making changes)
- Power BI admins have been briefed on importing the `.pbiviz` file

---

## Deployment

### Standard deploy (Terraform)

This is the normal release path. Terraform rebuilds and deploys the Cloud Function from the current `app/backend/` contents on every apply.

```bash
cd terraform
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

Expected output:
```
Apply complete. Resources: 4 added, 0 changed, 0 destroyed.
Outputs:
function_url = "https://us-central1-YOURPROJECT.cloudfunctions.net/pbi-agent-chat"
```

The function URL does not change between deploys. If you need a custom domain, configure Cloud Load Balancing in front of the function — this is not in scope for v1.

**Duration:** ~90 seconds for the function to become active. Old revisions continue serving until the new one is ready.

### Verify the deploy

```bash
FUNCTION_URL="$(terraform output -raw function_url)"
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"contents":[{"role":"user","parts":[{"text":"test"}]}]}'
```

Expected: `200` within 5 seconds.

---

## Secret rotation

Rotate the API key if it has been exposed, is approaching 90 days old, or follows your org's secret rotation policy.

### Step 1 — Generate a new key

```bash
NEW_API_KEY="$(openssl rand -base64 32)"
echo "New key (store this securely): $NEW_API_KEY"
```

### Step 2 — Update Secret Manager

```bash
echo -n "$NEW_API_KEY" | \
  gcloud secrets versions add pbi-agent-chat-api-key \
  --data-file=- \
  --project="YOUR_PROJECT_ID"
```

The Cloud Function automatically picks up the new `latest` version on its next invocation. No restart is required — the CFF module binds to `versions = ["latest"]`.

### Step 3 — Update the widget

Distribute the new API key to Power BI admins so they can update the format pane field in any reports using the widget. The key in the visual format pane must match the `latest` Secret Manager version.

### Step 4 — Verify

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $NEW_API_KEY" \
  -d '{"contents":[{"role":"user","parts":[{"text":"test"}]}]}'
```

### Step 5 — Disable the old version

```bash
# List all versions
gcloud secrets versions list pbi-agent-chat-api-key --project="YOUR_PROJECT_ID"

# Disable the old version (replace V1 with the version number)
gcloud secrets versions disable V1 --project="YOUR_PROJECT_ID"
```

Never delete the only remaining version.

---

## Monitoring

### Cloud Monitoring — Invocation metrics

Navigate to **Cloud Monitoring → Metrics Explorer** in the GCP Console, or use the Metrics API:

```bash
# Invocation count (last 1 hour)
gcloud monitoring metrics list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/invocations"'

# Error rate
gcloud monitoring metrics list \
  --filter='metric.type="cloudfunctions.googleapis.com/function/execution_times"'
```

### Cloud Logging — Structured logs

All invocations emit structured JSON logs to Cloud Logging. Query recent logs:

```bash
gcloud logging read \
  'resource.type="cloud_function" AND resource.labels.function_name="pbi-agent-chat"' \
  --project="YOUR_PROJECT_ID" \
  --freshness=1h \
  --format=json | jq '.[] | {severity, textPayload: jsonPayload}'
```

Key fields in `jsonPayload`:
| Field | Description |
|---|---|
| `severity` | `INFO`, `WARNING`, `ERROR` |
| `textPayload` | Human-readable log line (from Python `logging`) |
| `timestamp` | RFC3339 timestamp |

### Latency p99

```bash
gcloud logging read \
  'resource.type="cloud_function" AND resource.labels.function_name="pbi-agent-chat"' \
  --project="YOUR_PROJECT_ID" \
  --freshness=24h \
  --format=json | \
  jq -r '.[] | select(.jsonPayload.latency) | .jsonPayload.latency' | \
  sort -n | awk 'END {print "p99:", NR * 0.99 "th value"}'
```

### Alerting policy — error rate

Create an alerting policy when the 5-minute error rate exceeds 1%:

```bash
gcloud alpha monitoring policies create \
  --display-name="pbi-agent-chat error rate > 1%" \
  --condition-display-name="Cloud Function error rate" \
  --notification-channels="YOUR_CHANNEL_ID" \
  --project="YOUR_PROJECT_ID"
```

Alternatively, configure via the GCP Console: **Cloud Monitoring → Alerting → Create Policy**.

---

## Incident response

### Widget shows "Network error" or blank

**Severity:** Medium — dashboard users cannot chat with the agent.

1. Check Cloud Function is running:
   ```bash
   gcloud functions describe pbi-agent-chat \
     --region us-central1 --project="YOUR_PROJECT_ID" \
     --format="value(state)"
   ```
   Expected: `ACTIVE`. If `OFFLINE`, the function crashed or was disabled.

2. Check recent errors in Cloud Logging:
   ```bash
   gcloud logging read \
     'resource.type="cloud_function" AND resource.labels.function_name="pbi-agent-chat" AND severity>=ERROR' \
     --freshness=1h --project="YOUR_PROJECT_ID" --limit=20
   ```

3. Check Vertex AI Agent Engine is reachable:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT/locations/us-central1/reasoningEngines"
   ```
   Expected: `200`

4. If the function is offline, redeploy:
   ```bash
   cd terraform && terraform apply -var-file="terraform.tfvars"
   ```

### Function returns 502 Bad Gateway

**Severity:** High — the agent is not responding.

The Cloud Function reached Vertex AI but received an error. Check the Vertex AI API status and the agent's session configuration. The most common cause is the agent session timing out (default 30 minutes inactivity on the session).

### API key rotation not picked up

**Severity:** Medium — users cannot authenticate.

Cloud Functions refresh secrets on invocation. If the new key is not working within 60 seconds, force a function restart:

```bash
gcloud functions deploy pbi-agent-chat \
  --entry-point chat \
  --trigger-http \
  --runtime python313 \
  --project="YOUR_PROJECT_ID" \
  --region us-central1
```

This causes a brief (~30 second) outage as the function re-initialises.

---

## Rollback

### Roll back to a previous function revision

```bash
# List revisions
gcloud functions revisions list pbi-agent-chat --region us-central1

# Roll traffic to a specific revision
gcloud functions traffic split pbi-agent-chat \
  --region us-central1 \
  --to-revision=REVISION_NAME=100
```

Traffic split of `100` routes 100% of requests to the specified revision immediately.

To find the previous revision name:
```bash
gcloud functions revisions list pbi-agent-chat --region us-central1 --limit=5
```

### Roll back Terraform state

Terraform maintains a local state file (`terraform/terraform.tfstate`) in this repository. If the remote state in GCS is corrupted:

```bash
cd terraform
gcloud storage cp gs://YOUR_STATE_BUCKET/pbi-agent-widget/terraform.tfstate.backup \
  terraform.tfstate
terraform plan -var-file="terraform.tfvars"
```

Always run `terraform plan` before `terraform apply` when rolling back.

---

## CI/CD (GitHub Actions)

A GitHub Actions workflow is recommended for automated deploys. Example:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
    paths: ["app/backend/**", "terraform/**"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.10"
      - run: cd terraform && terraform init
      - run: cd terraform && terraform plan -var-file="terraform.tfvars"
      - run: cd terraform && terraform apply -var-file="terraform.tfvars" -auto-approve
        env:
          GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.GCP_SA_KEY }}
```

The service account key for `GOOGLE_APPLICATION_CREDENTIALS` needs:
- `roles/cloudfunctions.developer`
- `roles/secretmanager.secretAccessor`
- `roles/iam.serviceAccountUser`
- `roles/logging.logWriter`
