# Developer Guide

**Audience:** Engineers building, testing, and releasing this codebase.

---

## Prerequisites

Install all project runtimes via `mise`:

```bash
mise install
```

Verify:

```bash
node --version   # ≥ 20.x
python --version # ≥ 3.13
terraform --version # ≥ 1.10
gcloud --version # recent
```

You also need:

- GCP project with billing enabled
- Vertex AI Agent Engine resource already deployed
- `gcloud auth login` and `gcloud auth application-default login` run
- Power BI Desktop (Windows) for local widget testing

---

## Repository structure

```
app/
├── backend/          # Cloud Functions — pure Python
└── widget/          # Power BI Custom Visual — React + TypeScript + webpack
terraform/           # All GCP infrastructure via Terraform + CFF modules
docs/               # ADRs, runbooks, roadmap
```

Both `app/backend` and `app/widget` are independently deployable.

---

## Backend

### Local development

The Cloud Function runs on your local machine via the Functions Framework:

```bash
cd app/backend
python -m venv .venv
source .venv/bin/activate    # or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run locally — replace these with real values for local testing
export ALLOWED_API_KEY="test-key"
export AGENT_ENGINE_RESOURCE="projects/P/locations/us-central1/reasoningEngines/ID"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

func start --port 8080
```

`func start` is the Functions Framework dev server. It hot-reloads on file changes.

### Running tests

```bash
cd app/backend
source .venv/bin/activate
pip install pytest pytest-httpsbogus
pytest
```

### Deploying

Use the helper script or deploy directly:

```bash
# Option A — helper script (from app/widget/scripts/)
./scripts/deploy-function.sh <project> <region>

# Option B — direct gcloud
gcloud functions deploy pbi-agent-chat \
  --project "$PROJECT" \
  --region us-central1 \
  --runtime python313 \
  --entry-point chat \
  --source ./deployment/function.zip \
  --trigger-http \
  --allow-unauthenticated \
  --set-secrets ALLOWED_API_KEY=pbi-agent-chat-api-key:latest \
  --set-env-vars AGENT_ENGINE_RESOURCE="$AGENT_ENGINE_RESOURCE"
```

The GCS bucket for function source is created automatically by Terraform. For local deploys outside Terraform, create the zip manually:

```bash
cd app/backend
zip -r /tmp/function.zip main.py requirements.txt
gcloud functions deploy pbi-agent-chat \
  --project "$PROJECT" \
  --region us-central1 \
  --source /tmp/function.zip \
  # ...rest of flags
```

### Backend request shape

```http
POST https://REGION-PROJECT.cloudfunctions.net/chat
Content-Type: application/json
X-API-Key: your-api-key

{
  "session": "projects/.../sessions/SESSION_ID",   # optional — creates new session if omitted
  "contents": [                                     # required — Gemini API message format
    { "role": "user", "parts": [{ "text": "Hello" }] }
  ]
}
```

Response is a buffered JSON object (functions-framework does not support true streaming for Gen 2 HTTP functions). For streaming, a future migration to Cloud Run is required.

---

## Widget

### Setup

```bash
cd app/widget
npm install
```

### Development mode (live reload in Power BI)

Power BI visuals must be developed inside Power BI Desktop. The `pbiviz start` command starts a webpack dev server that the Power BI Desktop host connects to.

```bash
cd app/widget
npm start
```

This starts a webpack dev server on port 8080 with a self-signed certificate. Open Power BI Desktop, load the visual from the dev server URL (Power BI automatically detects it when you add the visual from the Developer Visual tab), and the visual hot-reloads as you edit `src/`.

To enable the Developer Visual tab in Power BI Desktop: File → Options → Preview Features → Developer Visual.

### Production build

```bash
cd app/widget
npm run package
```

Output: `dist/pbi-agent-chat-widget-1.0.0.pbiviz`.

The package command runs `webpack --mode production` and bundles the React app into the `.pbiviz`. It also runs `pbiviz package` which wraps everything into the visual format.

### File structure reference

```
app/widget/
├── src/
│   ├── visual.tsx              # IVisual interface implementation
│   │                              - Mounts React root on element
│   │                              - Reads endpoint/apiKey from dataView
│   │                              - Re-renders on every update
│   └── components/
│       └── ChatThread.tsx     # @assistant-ui/react + useChatRuntime
│                                  - Receives endpoint + apiKey as props
│                                  - Wires useChat to the backend URL
│                                  - Renders Thread, MessageInput, messages
├── capabilities.json           # Declares WebAccess privilege for HTTPS
│                                  - Add your function domain here before packaging
├── pbiviz.json               # Visual name, GUID, version, entry point
├── webpack.config.js           # Babel + TS + CSS loaders
│                                  - ts-loader for .tsx files
│                                  - babel-loader with @babel/preset-react
│                                  - mini-css-extract-plugin for prod CSS
└── scripts/
    └── deploy-function.sh     # Bundles backend + deploys via gcloud CLI
```

### Debugging the widget

Add `debugger` statements directly in the React code. They survive hot-reload in development mode. You can also use `console.log` — output appears in the browser's developer tools (F12) inside the visual's iframe.

The visual's iframe is sandboxed. To inspect it: in Power BI Desktop, press F12, select the iframe named `pbi-visual-report-*`.

### Adding to the visual

**Customising chat appearance:** Edit `src/components/ChatThread.tsx`. The component tree uses `@assistant-ui/react` primitives — see the [component API reference](https://github.com/assistant-ui/assistant-ui).

**Changing colours or fonts:** Override CSS variables on the root element or add styles in `style/visual.less`.

**Adding a data field:** Add a new data role in `capabilities.json`, update the dataView mapping, then read it in `visual.tsx` from `options.dataViews[0].categorical`.

---

## Terraform

### Validate

```bash
cd terraform
terraform init
terraform validate
terraform plan -var-file="terraform.tfvars"
```

### CFF module reference

| Resource | CFF Module | Key Inputs |
|---|---|---|
| Service Account | `modules/iam-service-account` | `name`, `project_id`, `iam_project_roles` |
| GCS bucket | `modules/gcs` | `name`, `project_id`, `location` |
| Cloud Function | `modules/cloud-function-v2` | `name`, `project_id`, `region`, `bucket_name`, `bundle_config`, `function_config`, `service_account_config`, `secrets` |
| API key secret | `modules/secret-manager` | `project_id`, `secrets` (map of secret name → `{iam, versions}`) |

All module sources use `github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/<name>?ref=v35.0.0`.

### Remote state

For team environments, configure a GCS backend in `providers.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket = "your-terraform-state-bucket"
    prefix = "pbi-agent-widget"
  }
}
```

---

## Release process

### Backend

1. Make changes to `app/backend/main.py`
2. Run smoke-test locally with `func start`
3. `terraform apply -var-file="terraform.tfvars"` — Terraform rebuilds and deploys the function from `app/backend/`

Terraform's `cloud-function-v2` module uploads the current `app/backend/` contents on every apply. No manual zip step is needed.

### Widget

1. Bump the version in `app/widget/pbiviz.json` (Semantic Versioning: `major.minor.patch`)
2. `npm run package`
3. Distribute the `.pbiviz` file to Power BI admins for upload to the organisational store

For CI/CD, automate step 2 with GitHub Actions or Cloud Build.

---

## Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `Unauthorized` from Cloud Function | Wrong or missing `X-API-Key` header | Verify the header matches the value in Secret Manager |
| `403 Forbidden` on Agent Engine | SA missing `roles/aiplatform.reasoningEngineUser` | Check `google_project_iam_member.agent_engine_user` in Terraform |
| Widget shows blank / no chat | CORS blocked by Power BI sandbox | Ensure the function URL uses HTTPS and the domain is in `capabilities.json` `WebAccess` allowlist |
| `pbiviz package` fails | Node version mismatch | Confirm `node --version` is ≥ 20.x; run `npm install` again |
| Function returns `502` | Agent Engine URL wrong or unreachable | Verify `AGENT_ENGINE_RESOURCE` env var matches the fully-qualified resource name |
