variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "api_key" {
  description = "Static API key for widget authentication. Store in Secret Manager."
  type        = string
  sensitive   = true
}

variable "agent_engine_resource" {
  description = <<-EOT
    Full resource name of the Vertex AI Agent Engine, e.g.
    projects/PROJECT/locations/REGION/reasoningEngines/ID
  EOT
  type        = string
  default     = ""
}
