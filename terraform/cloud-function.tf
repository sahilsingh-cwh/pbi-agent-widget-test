###############################################################################
# Service Account for the Cloud Function
# CFF module: modules/iam-service-account
###############################################################################

module "function-sa" {
  source     = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/iam-service-account?ref=v35.0.0"
  project_id = local.project_id
  name       = "sa-pbi-agent-chat"
  iam_project_roles = {
    (local.project_id) = [
      "roles/logging.logWriter",
      "roles/aiplatform.user",
    ]
  }
}

###############################################################################
# GCS Bucket for Cloud Function Source
# CFF module: modules/gcs
###############################################################################

module "function-bucket" {
  source     = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/gcs?ref=v35.0.0"
  project_id = local.project_id
  name       = "${local.project_id}-cf-source-pbi-agent-chat"
  location   = var.region
  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

###############################################################################
# Secret Manager — API Key (created but not used by function,
# which reads the key from ALLOWED_API_KEY env var instead)
# CFF module: modules/secret-manager
###############################################################################

module "api-key-secret" {
  source     = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/secret-manager?ref=v35.0.0"
  project_id = local.project_id
  secrets = {
    api-key = {
      versions = {
        v1 = {
          data = var.api_key
        }
      }
    }
  }
}

###############################################################################
# Cloud Function Gen 2
# CFF module: modules/cloud-function-v2
###############################################################################

module "cloud-function" {
  source      = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/cloud-function-v2?ref=v35.0.0"
  project_id  = local.project_id
  region      = var.region
  name        = local.function_name
  bucket_name = module.function-bucket.name
  bundle_config = {
    path = "${path.module}/../app/backend"
  }
  function_config = {
    entry_point     = "chat"
    runtime         = "python313"
    memory_mb       = 1024
    timeout_seconds = 120
  }
  service_account        = module.function-sa.email
  service_account_create = false
  environment_variables = {
    AGENT_ENGINE_RESOURCE = var.agent_engine_resource
    ALLOWED_API_KEY       = var.api_key
  }
  labels = {
    environment = var.environment
    component   = "agent-chat-backend"
    managed_by  = "terraform"
  }
}

###############################################################################
# Allow public unauthenticated access to the function.
# The API key is validated inside the function itself — this IAM setting
# only controls whether the HTTPS endpoint is reachable.
###############################################################################

resource "google_cloudfunctions2_function_iam_member" "public" {
  project        = local.project_id
  location       = var.region
  cloud_function = module.cloud-function.function_name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = local.project_id
  location = var.region
  name     = module.cloud-function.function_name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
