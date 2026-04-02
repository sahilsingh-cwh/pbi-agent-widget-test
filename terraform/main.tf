data "google_project" "project" {}

locals {
  function_name  = "pbi-agent-chat"
  project_id     = var.project_id
  project_number = data.google_project.project.number
}
