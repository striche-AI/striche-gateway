# STRICHE GATEWAY

A CLI-first TypeScript tool that converts OpenAPI/Swagger specs into ready-to-deploy Infrastructure-as-Code for API Gateways across multiple cloud platforms.

## 🚀 Features

- **Multi-Platform Support**: AWS (implemented), GCP & Azure (coming soon)
- **OpenAPI v3 Compatible**: Parse .yaml and .json specs
- **Zero-Config Deployment**: Generate and deploy with a single command
- **Infrastructure as Code**: Produces Terraform projects
- **Extensible Templates**: Platform-specific customization
- **Advanced CLI**: Bash script with colored output and validation
- **Idempotent Operations**: Safe to run multiple times

## 🏗️ Architecture

Striche Gateway normalizes APIs into a canonical model and renders platform-specific Infrastructure-as-Code:

```
OpenAPI Spec → Canonical Model → Platform Templates → Infrastructure Code → Cloud Deployment
```

### Supported Platforms

| Platform | Status | Services | Templates |
|----------|--------|----------|-----------|
| **AWS** | ✅ Ready | API Gateway + Lambda | `/templates/aws/` |
| **GCP** | 🚧 Coming Soon | Cloud Endpoints + Cloud Run | `/templates/gcp/` |
| **Azure** | 🚧 Coming Soon | API Management + Functions | `/templates/azure/` |

## 📋 Requirements

### Core Dependencies
- **Node.js** (16+) and npm
- **Git** for cloning the repository

### Platform-Specific Dependencies

#### AWS
- **Terraform CLI** (v1.x recommended)
- **AWS CLI** for authentication

#### GCP (Future)
- **Terraform CLI**
- **gcloud CLI** for authentication

#### Azure (Future)  
- **Terraform CLI**
- **Azure CLI** for authentication

## ⚡ Quick Start

### 1. Installation
```bash
git clone <repo>
cd striche-gateway
npm install
chmod +x striche.sh
```

### 2. Setup Cloud Credentials
```bash
# Interactive setup for AWS
./striche.sh setup-cloud -p aws

# Or manually set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="eu-west-2"
```

### 3. Deploy Your API
```bash
# One-command deployment
./striche.sh deploy -s specs/payment-service.yaml -p aws --auto-approve

# Step-by-step approach
./striche.sh validate -s specs/payment-service.yaml
./striche.sh generate -s specs/payment-service.yaml -p aws
./striche.sh plan
./striche.sh deploy -s specs/payment-service.yaml -p aws
```

### 4. Test and Manage
```bash
# Check deployment status
./striche.sh status

# Test API endpoints
./striche.sh test

# Clean up when done
./striche.sh destroy --auto-approve
./striche.sh clean
```

## 🛠️ CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `validate` | Validate OpenAPI spec syntax and structure |
| `generate` | Generate Infrastructure-as-Code from spec |
| `deploy` | Generate and deploy to cloud platform |
| `plan` | Show infrastructure deployment plan |
| `destroy` | Destroy cloud resources |
| `status` | Show current deployment status |
| `test` | Test deployed API endpoints |
| `setup-cloud` | Interactive cloud credentials setup |
| `clean` | Remove generated files |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --spec <file>` | OpenAPI spec file path | Required |
| `-p, --platform <name>` | Cloud platform (aws, gcp, azure) | `aws` |
| `-o, --out <dir>` | Output directory | `./out` |
| `-t, --templates <dir>` | Templates directory | `./templates` |
| `-r, --region <region>` | Cloud region | `eu-west-2` |
| `-u, --upstream <url>` | Upstream service URL | From spec |
| `--service-map <json>` | Service mapping JSON | - |
| `--auto-approve` | Skip confirmation prompts | - |
| `-h, --help` | Show help | - |

### Examples

```bash
# Validate an OpenAPI spec
./striche.sh validate -s specs/payment-service.yaml

# Generate for specific platform and region
./striche.sh generate -s specs/payment-service.yaml -p aws -r us-east-1

# Deploy with custom upstream
./striche.sh deploy -s specs/payment-service.yaml -p aws \
  -u https://my-backend.example.com --auto-approve

# Deploy to different platforms (future)
./striche.sh deploy -s specs/payment-service.yaml -p gcp -r us-central1
./striche.sh deploy -s specs/payment-service.yaml -p azure -r eastus

# Service mapping for multiple services
./striche.sh deploy -s specs/payment-service.yaml -p aws \
  --service-map '{"payments":"https://pay.example.com","auth":"https://auth.example.com"}'
```

## 📁 Project Structure

```
striche-gateway/
├── striche.sh              # Advanced CLI script
├── striche                 # CLI alias
├── src/                    # TypeScript source
│   ├── cli.ts             # Core CLI implementation
│   ├── commands/          # CLI commands
│   ├── parser/            # OpenAPI parser
│   └── render/            # Template renderer
├── templates/             # Platform templates
│   ├── aws/              # AWS-specific templates
│   │   ├── modules/
│   │   └── root/
│   ├── gcp/              # GCP templates (future)
│   └── azure/            # Azure templates (future)
├── specs/                # Example OpenAPI specs
└── out/                  # Generated infrastructure (gitignored)
```

## 🔧 Development Workflow

### Using TypeScript CLI Directly
```bash
# Validate spec
npx ts-node src/cli.ts validate -s specs/payment-service.yaml

# Generate infrastructure
npx ts-node src/cli.ts generate \
  -s specs/payment-service.yaml \
  -o ./out \
  --templates ./templates/aws \
  --force
```

### Using Bash CLI (Recommended)
```bash
# All-in-one deployment
./striche.sh deploy -s specs/payment-service.yaml --auto-approve

# Development cycle
./striche.sh validate -s specs/payment-service.yaml
./striche.sh generate -s specs/payment-service.yaml
./striche.sh plan
./striche.sh deploy -s specs/payment-service.yaml
```

## 🌍 Multi-Platform Deployment

### AWS (Current)
```bash
./striche.sh setup-cloud -p aws
./striche.sh deploy -s specs/payment-service.yaml -p aws -r eu-west-2
```

**Resources Created:**
- API Gateway HTTP API
- API Gateway Routes (one per endpoint)
- API Gateway Integrations (HTTP proxy to upstream)
- API Gateway Stage (auto-deploy)

### GCP (Coming Soon)
```bash
./striche.sh setup-cloud -p gcp
./striche.sh deploy -s specs/payment-service.yaml -p gcp -r us-central1
```

**Planned Resources:**
- Cloud Endpoints or API Gateway
- Cloud Run services
- Load Balancer configuration
- IAM roles and bindings

### Azure (Coming Soon)
```bash
./striche.sh setup-cloud -p azure
./striche.sh deploy -s specs/payment-service.yaml -p azure -r eastus
```

**Planned Resources:**
- API Management instance
- Azure Functions or Container Instances
- Application Gateway
- Azure Active Directory configuration

## 🔐 Security & Credentials

### AWS Credentials
```bash
# Option 1: Interactive setup
./striche.sh setup-cloud -p aws

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="eu-west-2"

# Option 3: AWS CLI profiles
aws configure
```

### Credential Storage
- Credentials saved to `.env` file (gitignored)
- Platform information persisted between commands
- Secure credential validation before operations

## 🧪 Testing

### API Endpoint Testing
```bash
# Test deployed endpoints automatically
./striche.sh test

# Manual testing
curl https://your-api-id.execute-api.eu-west-2.amazonaws.com/payments
```

### Infrastructure Validation
```bash
# Validate Terraform before applying
./striche.sh plan

# Check deployment status
./striche.sh status
```

## 🧹 Cleanup

### Destroy Cloud Resources
```bash
# Interactive confirmation
./striche.sh destroy

# Automatic approval
./striche.sh destroy --auto-approve
```

### Clean Local Files
```bash
# Remove generated files
./striche.sh clean

# Full cleanup (cloud + local)
./striche.sh destroy --auto-approve && ./striche.sh clean
```

## 🎯 Advanced Usage

### Custom Templates
```bash
# Use custom template directory
./striche.sh generate -s specs/payment-service.yaml \
  -t ./my-custom-templates/aws

# Platform-specific templates auto-discovered
# ./templates/aws/ → Used for AWS
# ./templates/gcp/ → Used for GCP  
# ./templates/azure/ → Used for Azure
```

### CI/CD Integration
```bash
# Non-interactive deployment pipeline
export AWS_ACCESS_KEY_ID="$CI_AWS_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$CI_AWS_SECRET_KEY"
export AWS_REGION="eu-west-2"

./striche.sh deploy -s specs/payment-service.yaml \
  -p aws --auto-approve
```

### Environment-Specific Deployments
```bash
# Development environment
./striche.sh deploy -s specs/payment-service.yaml \
  -p aws -r eu-west-2 \
  -u https://dev-api.example.com

# Production environment  
./striche.sh deploy -s specs/payment-service.yaml \
  -p aws -r us-east-1 \
  -u https://api.example.com
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/gcp-support`
3. **Add platform templates** in `/templates/<platform>/`
4. **Update CLI** to support new platform
5. **Test thoroughly** with the bash CLI
6. **Submit a pull request**

### Adding a New Platform

1. **Add platform to supported list** in `striche.sh`
2. **Create template directory** `/templates/<platform>/`
3. **Implement credential checking** in `check_cloud_credentials()`
4. **Add setup function** in `setup_<platform>_credentials()`
5. **Update documentation** and examples

## 📝 License

[Add your license here]

---

**Made with ❤️ for developers who want zero-friction API deployments**
