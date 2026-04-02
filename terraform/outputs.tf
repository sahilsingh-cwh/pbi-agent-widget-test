output "function_url" {
  description = "HTTPS URL of the deployed Cloud Function"
  value       = module.cloud-function.uri
}

output "function_name" {
  description = "Name of the Cloud Function"
  value       = module.cloud-function.function_name
}

output "service_account_email" {
  description = "Email of the Cloud Functions service account"
  value       = module.function-sa.email
}

output "secret_id" {
  description = "Secret Manager secret ID for the API key"
  value       = module.api-key-secret.secrets["api-key"].secret_id
}
