# Vertex AI Agent Chat Widget for Power BI

Embed a Gemini-powered chat agent inside any Power BI dashboard.

---

## Architecture

```
Power BI Dashboard
┌──────────────────────────────────┐
│  Agent Chat Widget (.pbiviz)     │
│  Sends HTTPS requests to...       │
└──────────────┬─────────────────────┘
               │ X-API-Key header
               ▼
┌──────────────────────────────────┐
│  Cloud Function (Python 3.13)     │
│  Validates API key               │
│  Calls Vertex AI Agent Engine    │
└──────────────┬─────────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Vertex AI Agent Engine           │
│  (gemini-2.5-flash model)       │
└──────────────────────────────────┘
```

---

## What you need before starting

- A GCP project with billing enabled
- `gcloud` CLI authenticated (`gcloud auth login`)
- Node.js 20+ and npm
- Terraform ≥ 1.10
- A deployed Vertex AI Agent Engine (ReasoningEngine)

---

## Step 1 — Deploy the Cloud Function backend

Edit `terraform/terraform.tfvars` with your values:

```hcl
project_id            = "your-gcp-project-id"
region                = "us-central1"
environment           = "dev"
api_key              = "your-secure-random-api-key"
agent_engine_resource = "projects/PROJECT_NUMBER/locations/us-central1/reasoningEngines/AGENT_ID"
```

Deploy:

```bash
cd terraform
terraform init
terraform apply -var-file="terraform.tfvars"
```

Copy the `function_url` output from Terraform — you'll need it for the widget.

---

## Step 2 — Configure the widget

Open `app/widget/src/visual.tsx` and update the two lines at the top:

```typescript
const ENDPOINT = "https://your-function-url.cloudfunctions.net/pbi-agent-chat";
const API_KEY = "your-api-key-from-terraform";
```

---

## Step 3 — Build the widget

```bash
cd app/widget
npm install
npm run package
```

A `.pbiviz` file will be created in `app/widget/dist/`.

---

## Step 4 — Import into Power BI

1. Open Power BI Desktop
2. Click **Get More Visuals** → **Import from file**
3. Select the `.pbiviz` file
4. Drop the visual onto the canvas

That's it — the chat widget will connect to your backend automatically.

---

## Testing the backend directly

```bash
curl -s -X POST "https://your-function-url.cloudfunctions.net/pbi-agent-chat" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"message": "What is your name?"}'
```

You should receive a JSON response like: `{"text": "I am a demo agent..."}`

---

## Project structure

```
├── app/
│   ├── backend/          # Cloud Function (Python)
│   │   └── main.py      # Entry point with CORS support
│   └── widget/          # Power BI Custom Visual
│       ├── src/
│       │   ├── visual.tsx       # Main visual class — EDIT THIS
│       │   └── components/
│       │       └── ChatThread.tsx  # React chat UI
│       └── package.json
├── terraform/          # Infrastructure as code
│   ├── main.tf          # Backend, IAM, API key secret
│   └── terraform.tfvars # Your configuration (NOT committed)
└── README.md
```

---

## Troubleshooting

**Widget shows "Failed to fetch"**
- Verify the Cloud Function is deployed and publicly accessible
- Check the API key in `visual.tsx` matches the deployed function's `ALLOWED_API_KEY`

**Widget shows "Unauthorized"**
- The API key in `visual.tsx` doesn't match the Cloud Function's configured key

**No response from agent**
- Check Cloud Function logs: `gcloud functions logs read pbi-agent-chat --region us-central1`
- Verify the Vertex AI Agent Engine is running
