# ADR-005: Cloud Foundation Fabric for Terraform

**Status:** Accepted
**Date:** 2026-04-01

---

## Context

We need to provision the following GCP resources for the backend:

- A Cloud Functions Gen 2 function
- A service account for that function
- A GCS bucket for function source code
- A Secret Manager secret for the API key
- IAM bindings: SA → Agent Engine, SA → Secret Manager, public → function

All infrastructure is defined in Terraform. The project standard is to use Google Cloud Foundation Fabric (CFF) modules wherever a suitable module exists, falling back to native Terraform resources only when no CFF module covers the required behaviour.

---

## Decision

CFF modules are used for all resources:

| Resource | CFF Module | Source |
|---|---|---|
| Service Account + IAM roles | `modules/iam-service-account` | `github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/iam-service-account?ref=v35.0.0` |
| GCS source bucket | `modules/gcs` | `github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/gcs?ref=v35.0.0` |
| Cloud Function Gen 2 | `modules/cloud-function-v2` | `github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/cloud-function-v2?ref=v35.0.0` |
| API key Secret | `modules/secret-manager` | `github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/secret-manager?ref=v35.0.0` |

The IAM binding that allows public (unauthenticated) HTTPS access to the function uses the native Terraform resource `google_cloudfunctions2_function_iam_member` because CFF's `cloud-function-v2` module does not expose `iam` arguments.

Provider configuration lives in `providers.tf` following CFF conventions. Terraform and backend configuration lives in `main.tf`. Resource provisioning lives in `cloud-function.tf`.

---

## Alternatives Considered

**Native Terraform resources throughout:** Every resource would be defined with `resource "google_..."` blocks. This is more explicit but significantly more verbose (approximately 3–4× the line count) and requires manual management of resource names, URIs, and IAM member strings that CFF modules handle automatically.

**No Terraform, manual GCP Console setup:** Rejected on repeatability and auditability grounds. Infrastructure as code is a non-negotiable requirement.

**Third-party Terraform provider (e.g., Random, TLS for key generation):** Adding hashicorp/random or hashicorp/tls for generating the API key value would increase the module count without benefit. The API key is supplied as a Terraform variable — its generation is the operator's choice (e.g., `openssl rand -base64 32`).

---

## Consequences

**Positive:**
- CFF modules are tested and maintained by Google's Cloud Foundation team. They handle edge cases (e.g., service account reuse, IAM deduplication) that native Terraform resources require careful manual handling of.
- The module call graph is small and readable — one Terraform file per logical group.
- All modules reference `?ref=v35.0.0` — pinned to a specific release tag. Future upgrades require a single version bump.
- CFF conventions (e.g., `iam_project_roles` map for project-level IAM grants) are familiar to teams already using CFF elsewhere.

**Negative (Trade-offs):**
- **CFF module API is not stable across major versions.** Upgrading from v35 to a future v36 may introduce breaking changes to module inputs. The upgrade path is: bump the `?ref` version, run `terraform plan`, review changes, apply.
- **The GCS bucket name references `local.project_id`** which includes the full project ID string. GCP bucket names cannot contain the string `google`. If the project ID contains `google`, the `module "function-bucket"` resource name must be changed to a compliant string.
- **The `cloud-function-v2` module does not expose per-revision IAM.** The `google_cloudfunctions2_function_iam_member` resource is a workaround. If CFF adds native IAM support to the module in a future version, this resource should be removed from `cloud-function.tf`.
