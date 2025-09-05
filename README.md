# STRICHE GATEWAY

API Gateway is a CLI-first TypeScript tool that converts OpenAPI/Swagger specs into ready-to-deploy Terraform projects for API Gateways (AWS HTTP API by default).
This README gives: description, requirements, usage (both from source and built package), and how to deploy to AWS.

## Description

A simple, opinionated generator that:

- Parses one or more OpenAPI v3 specs (.yaml / .json).
- Normalizes the API into a canonical model: services[] and routes[].
- Resolves each service's upstream URL (from spec or CLI overrides).
- Renders Handlebars templates into a Terraform project (out/).
- Produces Terraform that can be applied directly (no manual edits required).

## Goals:

- Zero friction for users who don't know Terraform/AWS.
- Deterministic output and stable resource IDs so Terraform is idempotent.
- Extensible templates so teams can customize output.

## Requirements
- Node.js (16+) and npm (or yarn).
- Terraform CLI (v1.x recommended) for plan/apply/validate.
- AWS CLI or environment credentials for deployment.
- Optional dev deps: ts-node and typescript if running from source.

Environment variables commonly used:
```bash

# for AWS
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1

# optional defaults used by the generator
export DEFAULT_RATE_LIMIT_RPS=100
export DEFAULT_RATE_LIMIT_BURST=200


```
---

## Installation

```bash

git clone <repo>
npm install

```

---

## CLI Usage
### Commands
- generate — convert spec(s) into Terraform
- validate — validate an OpenAPI spec (syntax + basic checks)

### Common flags for generate
- -s, --spec <path...> — one or more OpenAPI files (repeatable)
- -o, --out <dir> — output directory (required)
- -t, --templates <dir> — custom templates dir (optional)
- --service-map <json> — JSON string mapping {"serviceName":"https://upstream"}
- -u, --upstream <url> — global upstream override (applies to all services)
- -f, --force — overwrite out directory if present

## Usage — Not built (run from source with ts-node)

You can run the CLI directly from the source (useful during development):

### validate
``` npx ts-node src/cli.ts validate -s ./example/auth.yaml ```

### generate (multiple specs)
```bash
npx ts-node src/cli.ts generate \
  -s ./example/auth.yaml \
  -o ./out \
  --templates ./templates \
  --service-map '{"auth":"https://api.example.com/auth/v1","payments":"https://api.example.com/payments/v1"}'
  
  ```
Usage — Built package (compiled and/or globally installed)

Build and run the compiled CLI:

```bash
    coming soon
```

<!-- ### Notes:

If --templates is omitted, the generator uses ./templates in the CWD if present, otherwise the bundled templates shipped with the package.

If --service-map is omitted, upstreams come from each spec's servers[0].url or --upstream. -->

## How to deploy to AWS (step-by-step)

```bash 
cd out
terraform init -backend=false
terraform validate
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars -auto-approve

```
This creates resources in the AWS account defined by your environment credentials.
