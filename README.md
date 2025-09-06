# STRICHE GATEWAY

A CLI-first TypeScript tool that converts OpenAPI/Swagger specs into ready-to-deploy Infrastructure-as-Code for API Gateways across multiple cloud platforms.

## 🚀 Features

- **Unified Gateway Architecture**: Single endpoint for multiple microservices with dynamic routing
- **Multi-Service Support**: Deploy multiple OpenAPI specs as unified or separate services
- **Multi-Platform Support**: AWS (implemented), GCP & Azure (coming soon)
- **OpenAPI v3 Compatible**: Parse .yaml and .json specs with vendor extensions
- **Rate Limiting**: Built-in support for `x-rate-limit` vendor extension
- **Service Discovery**: Intelligent service grouping via `x-service` declarations
- **Zero-Config Deployment**: Generate and deploy with a single command
- **Infrastructure as Code**: Produces Terraform projects with dynamic templates
- **Extensible Templates**: Platform-specific customization with Handlebars
- **Advanced CLI**: Bash script with colored output and validation
- **Idempotent Operations**: Safe to run multiple times

## 🏗️ Architecture

Striche Gateway supports two deployment patterns and converts OpenAPI specs into complete cloud infrastructure:

### Deployment Patterns

#### Unified Gateway (Default)
- **Single API Gateway**: One endpoint serving multiple microservices
- **Dynamic Routing**: Routes requests to backend services based on path patterns
- **Consolidated Access**: Single domain with multiple service backends
- **Ideal for**: Microservices architectures requiring unified access points

#### Separate Services
- **Individual Gateways**: Each OpenAPI spec gets its own gateway
- **Service Isolation**: Complete separation between services
- **Independent Scaling**: Each service can scale independently
- **Ideal for**: Service-oriented architectures with clear boundaries

### Pipeline Flow
```
OpenAPI Spec → Canonical Model → Platform Templates → Infrastructure Code → Cloud Deployment
```

### Supported Platforms

| Platform | Status | Services | Templates |
|----------|--------|----------|-----------|
| **AWS** | ✅ Ready | API Gateway v2 + Dynamic Routing | `/templates/aws/` |
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

## 📝 OpenAPI Vendor Extensions

Striche Gateway supports custom OpenAPI vendor extensions to enable advanced gateway features:

### **x-service**: Service Grouping
Define service boundaries for unified gateway routing:

```yaml
# Global service declaration
openapi: 3.0.3
info:
  title: Authentication Service API
x-service: auth    # Groups all paths under 'auth' service

# Path-level service override
paths:
  /admin/users:
    x-service: admin  # Routes to different service
    get:
      summary: Admin user management
```

### **x-rate-limit**: Rate Limiting
Configure per-endpoint rate limiting policies:

```yaml
paths:
  /login:
    post:
      summary: User login
      x-rate-limit:
        requests: 10    # 10 requests
        period: 60      # per 60 seconds  
        burst: 20       # burst up to 20
      responses:
        '200':
          description: Login successful
          
  /register:
    post:
      summary: User registration
      x-rate-limit:
        requests: 5     # Stricter for registration
        period: 300     # per 5 minutes
        burst: 10
      responses:
        '201':
          description: User registered
```

### **Service Discovery Priority**
Striche Gateway determines service names using this priority:

1. **Global `x-service`**: Applies to all paths in the spec
2. **Path-level `x-service`**: Overrides global for specific paths  
3. **Operation-level `x-service`**: Overrides path-level for specific methods
4. **Server URL path**: Extracts service name from server URL path segment
5. **First tag**: Uses first tag from operation tags array
6. **Path segment**: Uses first path segment as service name
7. **Fallback**: Uses 'root' as service name

### **Generated Infrastructure**
These extensions translate to cloud infrastructure:

```yaml
# OpenAPI with extensions
x-service: auth
paths:
  /login:
    post:
      x-rate-limit: { requests: 10, period: 60 }
```

```hcl
# Generated Terraform (AWS)
resource "aws_apigatewayv2_route" "auth_login" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /login"
  
  throttle_settings {
    rate_limit  = 10
    burst_limit = 20
  }
}
```

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

#### Unified Gateway (Multiple Services)
```bash
# Deploy multiple services through a unified gateway (default)
./striche.sh deploy -s specs/auth-service.yaml,specs/payment-service.yaml -p aws --auto-approve

# Step-by-step unified deployment
./striche.sh validate -s specs/auth-service.yaml,specs/payment-service.yaml
./striche.sh generate -s specs/auth-service.yaml,specs/payment-service.yaml -p aws
./striche.sh deploy -s specs/auth-service.yaml,specs/payment-service.yaml -p aws
```

#### Separate Services
```bash
# Deploy as separate individual gateways
./striche.sh deploy -s specs/payment-service.yaml -p aws --separate --auto-approve

# Multiple specs as separate services
./striche.sh deploy -s specs/auth-service.yaml,specs/payment-service.yaml -p aws --separate
```

#### Legacy Single Service
```bash
# Traditional single service deployment
./striche.sh deploy -s specs/payment-service.yaml -p aws --auto-approve
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
| `-s, --spec <file>` | OpenAPI spec file path (comma-separated for multiple) | Required |
| `-p, --platform <name>` | Cloud platform (aws, gcp, azure) | `aws` |
| `-o, --out <dir>` | Output directory | `./out` |
| `-t, --templates <dir>` | Templates directory | `./templates` |
| `-r, --region <region>` | Cloud region | `eu-west-2` |
| `-u, --upstream <url>` | Upstream service URL | From spec |
| `--service-map <json>` | Service mapping JSON | - |
| `--unified` | Deploy as unified gateway (default) | `true` |
| `--separate` | Deploy as separate services | `false` |
| `--auto-approve` | Skip confirmation prompts | - |
| `-h, --help` | Show help | - |

### Examples

```bash
# Validate OpenAPI specs
./striche.sh validate -s specs/payment-service.yaml
./striche.sh validate -s specs/auth-service.yaml,specs/payment-service.yaml

# Unified Gateway - Multiple services through single endpoint
./striche.sh deploy -s specs/auth-service.yaml,specs/payment-service.yaml -p aws --auto-approve
./striche.sh generate -s specs/auth-service.yaml,specs/payment-service.yaml -p aws -r us-east-1

# Separate Services - Individual gateways
./striche.sh deploy -s specs/auth-service.yaml,specs/payment-service.yaml -p aws --separate
./striche.sh deploy -s specs/payment-service.yaml -p aws --separate -r us-west-2

# Custom upstream for single service
./striche.sh deploy -s specs/payment-service.yaml -p aws \
  -u https://my-backend.example.com --auto-approve

# Platform-specific deployments (future)
./striche.sh deploy -s specs/payment-service.yaml -p gcp -r us-central1
./striche.sh deploy -s specs/payment-service.yaml -p azure -r eastus

# Advanced service mapping
./striche.sh deploy -s specs/payment-service.yaml,specs/auth-service.yaml -p aws \
  --service-map '{"payments":"https://pay.example.com","auth":"https://auth.example.com"}'
```

### **OpenAPI Vendor Extensions Examples**

```yaml
# Example: Auth service with rate limiting
openapi: 3.0.3
info:
  title: Authentication Service API
  version: 1.0.0
x-service: auth

paths:
  /login:
    post:
      summary: User login
      x-rate-limit:
        requests: 10    # 10 login attempts
        period: 60      # per minute
        burst: 15       # burst protection
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        '200':
          description: Login successful
          
  /register:
    post:
      summary: User registration  
      x-rate-limit:
        requests: 3     # Stricter for new accounts
        period: 300     # per 5 minutes
        burst: 5
      responses:
        '201':
          description: User created

# Example: Multi-service routing
paths:
  /payments/process:
    x-service: payments  # Routes to payment service
    post:
      x-rate-limit:
        requests: 100
        period: 60
        
  /admin/users:
    x-service: admin     # Routes to admin service
    get:
      x-rate-limit:
        requests: 50
        period: 60
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
│   │   ├── modules/      # Service module templates
│   │   │   └── service/  # Dynamic routing templates
│   │   └── root/         # Root infrastructure templates
│   ├── gcp/              # GCP templates (future)
│   └── azure/            # Azure templates (future)
├── specs/                # Example OpenAPI specs
│   ├── auth-service.yaml # Authentication service spec
│   └── payment-service.yaml # Payment service spec
└── out/                  # Generated infrastructure (gitignored)
    ├── main.tf           # Generated root Terraform
    ├── variables.tf      # Dynamic variables
    ├── terraform.tfvars  # Service configurations
    └── modules/          # Generated service modules
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

## 🔄 Unified Gateway Pattern

Striche Gateway's unified mode creates a single API Gateway that routes to multiple backend microservices, solving the "one endpoint for different services" requirement.

### How It Works

1. **Single Gateway**: One API Gateway serves all microservices
2. **Dynamic Routing**: Routes are mapped to specific upstream services based on path patterns
3. **Service Resolution**: Each route knows its target backend service
4. **Consolidated Domain**: All services accessible through one domain

### Example Deployment

```bash
# Deploy auth and payment services through unified gateway
./striche.sh deploy -s specs/auth-service.yaml,specs/payment-service.yaml -p aws

# Results in single gateway with routes:
# https://your-gateway.execute-api.region.amazonaws.com/auth/* → https://api.auth.com/auth/v1
# https://your-gateway.execute-api.region.amazonaws.com/payments/* → https://api.payment.com/payments/v1
```

### Generated Infrastructure

- **Single API Gateway**: One HTTP API for all services
- **Per-Route Integrations**: Each route points to its specific backend
- **Dynamic Upstream Mapping**: Handlebars templates generate proper service routing
- **Consolidated Variables**: All service configurations in one place

### Use Cases

- **Microservices Architecture**: Single entry point for distributed services
- **API Composition**: Combining multiple APIs behind one interface
- **Service Discovery**: Unified access to backend services
- **Cross-Service Routing**: Client connects to one gateway, accesses all services

## 🌍 Multi-Platform Deployment

### AWS (Current)
```bash
./striche.sh setup-cloud -p aws
./striche.sh deploy -s specs/payment-service.yaml -p aws -r eu-west-2
```

**Resources Created:**
- API Gateway HTTP API (v2)
- API Gateway Routes (dynamic per OpenAPI paths)
- API Gateway Integrations (HTTP proxy with upstream mapping)
- API Gateway Stage (auto-deploy with proper routing)
- Route-specific upstream configurations
- Dynamic service mapping from OpenAPI specs

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
