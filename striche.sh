#!/bin/bash

# Striche Gateway - Advanced CLI Script
# Usage: ./striche.sh [command] [options]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEFAULT_OUT_DIR="./out"
DEFAULT_TEMPLATES_DIR="./templates"
DEFAULT_REGION="eu-west-2"
DEFAULT_PLATFORM="aws"
SUPPORTED_PLATFORMS=("aws" "gcp" "azure")

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
${GREEN}Striche Gateway CLI${NC}

${YELLOW}USAGE:${NC}
    ./striche.sh <command> [options]

${YELLOW}COMMANDS:${NC}
    ${GREEN}validate${NC}          Validate OpenAPI spec(s)
    ${GREEN}generate${NC}          Generate Infrastructure-as-Code from OpenAPI spec(s)
    ${GREEN}deploy${NC}            Generate and deploy to cloud platform
    ${GREEN}destroy${NC}           Destroy cloud resources
    ${GREEN}plan${NC}              Show infrastructure plan
    ${GREEN}status${NC}            Show deployment status
    ${GREEN}logs${NC}              Show API Gateway logs
    ${GREEN}test${NC}              Test API endpoints
    ${GREEN}setup-cloud${NC}       Setup cloud credentials interactively
    ${GREEN}clean${NC}             Clean generated files

${YELLOW}OPTIONS:${NC}
    -s, --spec <file>         OpenAPI spec file (repeatable for multiple specs)
    -o, --out <dir>           Output directory (default: ${DEFAULT_OUT_DIR})
    -t, --templates <dir>     Templates directory (default: ${DEFAULT_TEMPLATES_DIR})
    -p, --platform <name>     Cloud platform: aws, gcp, azure (default: ${DEFAULT_PLATFORM})
    -r, --region <region>     Cloud region (default: ${DEFAULT_REGION})
    -u, --upstream <url>      Upstream service URL
    --service-map <json>      Service mapping JSON
    --unified                Deploy as unified gateway (single endpoint, default)
    --separate               Deploy as separate services (multiple endpoints)
    --auto-approve           Skip confirmation prompts
    -h, --help               Show this help

${YELLOW}PLATFORMS:${NC}
    ${GREEN}aws${NC}              Amazon Web Services (API Gateway + Lambda)
    ${GREEN}gcp${NC}              Google Cloud Platform (Cloud Endpoints + Cloud Run) [Coming Soon]
    ${GREEN}azure${NC}            Microsoft Azure (API Management + Functions) [Coming Soon]

${YELLOW}EXAMPLES:${NC}
    ./striche.sh validate -s specs/payment-service.yaml
    ./striche.sh generate -s specs/payment-service.yaml -p aws
    ./striche.sh deploy -s specs/payment-service.yaml -p aws --auto-approve
    ./striche.sh deploy -s specs/auth-service.yaml -s specs/payment-service.yaml --unified --auto-approve
    ./striche.sh deploy -s specs/auth-service.yaml -s specs/payment-service.yaml --separate --auto-approve
    ./striche.sh deploy -s specs/auth-service.yaml -s specs/payment-service.yaml --service-map '{"auth":"https://auth.company.com","payments":"https://payments.company.com"}'
    ./striche.sh test -s specs/payment-service.yaml
    ./striche.sh setup-cloud -p aws

EOF
}

check_dependencies() {
    local platform="$1"
    local missing_deps=()
    
    # Common dependencies
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    # Platform-specific dependencies
    case "$platform" in
        aws)
            if ! command -v terraform &> /dev/null; then
                missing_deps+=("terraform")
            fi
            if ! command -v aws &> /dev/null; then
                missing_deps+=("aws-cli")
            fi
            ;;
        gcp)
            if ! command -v terraform &> /dev/null; then
                missing_deps+=("terraform")
            fi
            if ! command -v gcloud &> /dev/null; then
                missing_deps+=("gcloud-cli")
            fi
            ;;
        azure)
            if ! command -v terraform &> /dev/null; then
                missing_deps+=("terraform")
            fi
            if ! command -v az &> /dev/null; then
                missing_deps+=("azure-cli")
            fi
            ;;
    esac
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies for platform '$platform': ${missing_deps[*]}"
        log_info "Please install the missing dependencies and try again."
        exit 1
    fi
}

validate_platform() {
    local platform="$1"
    
    if [[ ! " ${SUPPORTED_PLATFORMS[@]} " =~ " ${platform} " ]]; then
        log_error "Unsupported platform: $platform"
        log_info "Supported platforms: ${SUPPORTED_PLATFORMS[*]}"
        exit 1
    fi
    
    if [ "$platform" != "aws" ]; then
        log_warning "Platform '$platform' is not yet implemented. Only 'aws' is currently supported."
        log_info "AWS will be used as the default platform for now."
        platform="aws"
    fi
    
    echo "$platform"
}

check_cloud_credentials() {
    local platform="$1"
    
    case "$platform" in
        aws)
            if ! aws sts get-caller-identity &> /dev/null; then
                log_error "AWS credentials not configured or invalid"
                log_info "Run './striche.sh setup-cloud -p aws' to configure credentials"
                exit 1
            fi
            ;;
        gcp)
            if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 &> /dev/null; then
                log_error "GCP credentials not configured or invalid"
                log_info "Run './striche.sh setup-cloud -p gcp' to configure credentials"
                exit 1
            fi
            ;;
        azure)
            if ! az account show &> /dev/null; then
                log_error "Azure credentials not configured or invalid"
                log_info "Run './striche.sh setup-cloud -p azure' to configure credentials"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown platform: $platform"
            exit 1
            ;;
    esac
}

setup_cloud_credentials() {
    local platform="$1"
    local region="$2"
    
    case "$platform" in
        aws)
            setup_aws_credentials "$region"
            ;;
        gcp)
            setup_gcp_credentials "$region"
            ;;
        azure)
            setup_azure_credentials "$region"
            ;;
        *)
            log_error "Platform '$platform' not yet implemented"
            exit 1
            ;;
    esac
}

setup_aws_credentials() {
    local region="$1"
    
    log_info "Setting up AWS credentials..."
    echo
    read -p "Enter your AWS Access Key ID: " access_key
    read -s -p "Enter your AWS Secret Access Key: " secret_key
    echo
    read -p "Enter your AWS Region (default: ${region}): " user_region
    region=${user_region:-$region}
    
    export AWS_ACCESS_KEY_ID="$access_key"
    export AWS_SECRET_ACCESS_KEY="$secret_key"
    export AWS_REGION="$region"
    
    log_info "Testing AWS credentials..."
    if aws sts get-caller-identity &> /dev/null; then
        log_success "AWS credentials configured successfully!"
        
        # Save to environment file
        cat > .env << EOF
export PLATFORM="aws"
export AWS_ACCESS_KEY_ID="$access_key"
export AWS_SECRET_ACCESS_KEY="$secret_key"
export AWS_REGION="$region"
EOF
        log_info "Credentials saved to .env file"
        log_warning "Add .env to your .gitignore to keep credentials secure"
    else
        log_error "Failed to validate AWS credentials"
        exit 1
    fi
}

setup_gcp_credentials() {
    local region="$1"
    
    log_info "Setting up GCP credentials..."
    log_info "This will open a browser for authentication..."
    
    gcloud auth login
    
    echo
    read -p "Enter your GCP Project ID: " project_id
    read -p "Enter your GCP Region (default: ${region}): " user_region
    region=${user_region:-$region}
    
    gcloud config set project "$project_id"
    gcloud config set compute/region "$region"
    
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 &> /dev/null; then
        log_success "GCP credentials configured successfully!"
        
        # Save to environment file
        cat > .env << EOF
export PLATFORM="gcp"
export GCP_PROJECT_ID="$project_id"
export GCP_REGION="$region"
EOF
        log_info "Credentials saved to .env file"
    else
        log_error "Failed to validate GCP credentials"
        exit 1
    fi
}

setup_azure_credentials() {
    local region="$1"
    
    log_info "Setting up Azure credentials..."
    log_info "This will open a browser for authentication..."
    
    az login
    
    echo
    read -p "Enter your Azure Subscription ID: " subscription_id
    read -p "Enter your Azure Region (default: ${region}): " user_region
    region=${user_region:-$region}
    
    az account set --subscription "$subscription_id"
    
    if az account show &> /dev/null; then
        log_success "Azure credentials configured successfully!"
        
        # Save to environment file
        cat > .env << EOF
export PLATFORM="azure"
export AZURE_SUBSCRIPTION_ID="$subscription_id"
export AZURE_REGION="$region"
EOF
        log_info "Credentials saved to .env file"
    else
        log_error "Failed to validate Azure credentials"
        exit 1
    fi
}

validate_spec() {
    local spec_files=("$@")
    
    if [ ${#spec_files[@]} -eq 0 ]; then
        log_error "No spec files provided"
        exit 1
    fi
    
    for spec_file in "${spec_files[@]}"; do
        if [ ! -f "$spec_file" ]; then
            log_error "Spec file not found: $spec_file"
            exit 1
        fi
        
        log_info "Validating OpenAPI spec: $spec_file"
        npx ts-node src/cli.ts validate -s "$spec_file"
    done
    log_success "Spec validation completed for all files"
}

generate_infrastructure() {
    local out_dir="$1"
    local templates_dir="$2"
    local platform="$3"
    local upstream="$4"
    local service_map="$5"
    shift 5
    local spec_files=("$@")
    
    if [ ${#spec_files[@]} -eq 0 ]; then
        log_error "No spec files provided"
        exit 1
    fi
    
    # Check all spec files exist
    for spec_file in "${spec_files[@]}"; do
        if [ ! -f "$spec_file" ]; then
            log_error "Spec file not found: $spec_file"
            exit 1
        fi
    done
    
    log_info "Generating $platform infrastructure from: ${spec_files[*]}"
    
    # Use platform-specific templates if they exist
    local platform_templates="$templates_dir/$platform"
    if [ -d "$platform_templates" ]; then
        templates_dir="$platform_templates"
        log_info "Using platform-specific templates: $platform_templates"
    else
        log_info "Using generic templates: $templates_dir"
    fi
    
    # Build command with multiple spec files
    local cmd="npx ts-node src/cli.ts generate"
    for spec_file in "${spec_files[@]}"; do
        cmd="$cmd -s $spec_file"
    done
    cmd="$cmd -o $out_dir --templates $templates_dir --force"
    
    if [ -n "$upstream" ]; then
        cmd="$cmd --upstream $upstream"
    fi
    
    if [ -n "$service_map" ]; then
        cmd="$cmd --service-map '$service_map'"
    fi
    
    if [ "$SEPARATE" = "true" ]; then
        cmd="$cmd --separate"
    elif [ "$UNIFIED" = "true" ]; then
        cmd="$cmd --unified"
    fi
    
    eval $cmd
    log_success "Infrastructure generation completed for platform: $platform"
}

infrastructure_plan() {
    local out_dir="$1"
    local platform="$2"
    
    if [ ! -d "$out_dir" ]; then
        log_error "Output directory not found: $out_dir. Run generate first."
        exit 1
    fi
    
    log_info "Running infrastructure plan for platform: $platform"
    cd "$out_dir"
    
    case "$platform" in
        aws|gcp|azure)
            terraform init -backend=false > /dev/null
            terraform plan -var-file=terraform.tfvars
            ;;
        *)
            log_error "Platform '$platform' not yet implemented"
            exit 1
            ;;
    esac
    
    cd - > /dev/null
}

deploy_infrastructure() {
    local out_dir="$1"
    local platform="$2"
    local auto_approve="$3"
    
    if [ ! -d "$out_dir" ]; then
        log_error "Output directory not found: $out_dir. Run generate first."
        exit 1
    fi
    
    check_cloud_credentials "$platform"
    
    log_info "Deploying infrastructure to platform: $platform"
    cd "$out_dir"
    
    case "$platform" in
        aws|gcp|azure)
            terraform init -backend=false > /dev/null
            terraform validate
            
            if [ "$auto_approve" = "true" ]; then
                terraform apply -var-file=terraform.tfvars -auto-approve
            else
                terraform apply -var-file=terraform.tfvars
            fi
            ;;
        *)
            log_error "Platform '$platform' not yet implemented"
            exit 1
            ;;
    esac
    
    log_success "Deployment completed on platform: $platform"
    
    # Show endpoints
    show_api_endpoints "$platform"
    
    cd - > /dev/null
}

show_api_endpoints() {
    local platform="$1"
    
    case "$platform" in
        aws|gcp|azure)
            if command -v jq &> /dev/null; then
                local endpoints=$(terraform output -json api_endpoints 2>/dev/null | jq -r '. | to_entries[] | "\(.key): \(.value)"' 2>/dev/null || echo "No endpoints found")
                log_info "API Endpoints:"
                echo "$endpoints"
            else
                log_warning "jq not installed. Install jq to see formatted endpoint output."
                terraform output api_endpoints 2>/dev/null || log_warning "No endpoints found"
            fi
            ;;
        *)
            log_warning "Endpoint display not implemented for platform: $platform"
            ;;
    esac
}

destroy_infrastructure() {
    local out_dir="$1"
    local platform="$2"
    local auto_approve="$3"
    
    if [ ! -d "$out_dir" ]; then
        log_error "Output directory not found: $out_dir"
        exit 1
    fi
    
    check_cloud_credentials "$platform"
    
    log_warning "This will destroy all $platform resources!"
    
    if [ "$auto_approve" != "true" ]; then
        read -p "Are you sure you want to continue? (y/N): " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            log_info "Aborted"
            exit 0
        fi
    fi
    
    log_info "Destroying infrastructure on platform: $platform"
    cd "$out_dir"
    
    case "$platform" in
        aws|gcp|azure)
            if [ "$auto_approve" = "true" ]; then
                terraform destroy -var-file=terraform.tfvars -auto-approve
            else
                terraform destroy -var-file=terraform.tfvars
            fi
            ;;
        *)
            log_error "Platform '$platform' not yet implemented"
            exit 1
            ;;
    esac
    
    log_success "Infrastructure destroyed on platform: $platform"
    cd - > /dev/null
}

get_deployment_status() {
    local out_dir="$1"
    local platform="$2"
    
    if [ ! -d "$out_dir" ]; then
        log_error "Output directory not found: $out_dir"
        exit 1
    fi
    
    check_cloud_credentials "$platform"
    
    log_info "Checking deployment status for platform: $platform"
    cd "$out_dir"
    
    case "$platform" in
        aws|gcp|azure)
            if [ -f "terraform.tfstate" ]; then
                if command -v jq &> /dev/null; then
                    terraform show -json terraform.tfstate | jq -r '.values.outputs.api_endpoints.value // {}'
                else
                    terraform output api_endpoints 2>/dev/null || log_warning "No endpoints found"
                fi
            else
                log_warning "No Terraform state found. Infrastructure may not be deployed."
            fi
            ;;
        *)
            log_error "Platform '$platform' not yet implemented"
            exit 1
            ;;
    esac
    
    cd - > /dev/null
}

test_api_endpoints() {
    local out_dir="$1"
    local platform="$2"
    
    if [ ! -d "$out_dir" ]; then
        log_error "Output directory not found: $out_dir"
        exit 1
    fi
    
    check_cloud_credentials "$platform"
    
    log_info "Testing API endpoints for platform: $platform"
    cd "$out_dir"
    
    if [ -f "terraform.tfstate" ]; then
        # This logic may need to be platform-specific in the future
        local base_url=""
        
        case "$platform" in
            aws)
                if command -v jq &> /dev/null; then
                    base_url=$(terraform output -json api_endpoints 2>/dev/null | jq -r '.payments // empty' 2>/dev/null)
                fi
                ;;
            gcp|azure)
                log_warning "Endpoint testing not yet implemented for platform: $platform"
                cd - > /dev/null
                return 0
                ;;
        esac
        
        if [ -z "$base_url" ]; then
            log_error "No API endpoints found in Terraform state"
            exit 1
        fi
        
        log_info "Testing endpoints for: $base_url"
        
        # Test some basic endpoints (this could be made configurable)
        local endpoints=("/payments" "/payment-methods")
        
        for endpoint in "${endpoints[@]}"; do
            log_info "Testing GET $endpoint"
            local status=$(curl -s -o /dev/null -w "%{http_code}" "$base_url$endpoint" 2>/dev/null || echo "000")
            if [ "$status" = "200" ]; then
                log_success "✓ $endpoint - HTTP $status"
            else
                log_warning "✗ $endpoint - HTTP $status"
            fi
        done
    else
        log_error "No Terraform state found"
        exit 1
    fi
    
    cd - > /dev/null
}

clean_generated_files() {
    local out_dir="$1"
    
    if [ -d "$out_dir" ]; then
        log_info "Cleaning generated files in $out_dir"
        rm -rf "$out_dir"
        log_success "Generated files cleaned"
    else
        log_info "No generated files to clean"
    fi
}

# Parse command line arguments
COMMAND=""
SPEC_FILE=""
OUT_DIR="$DEFAULT_OUT_DIR"
TEMPLATES_DIR="$DEFAULT_TEMPLATES_DIR"
PLATFORM="$DEFAULT_PLATFORM"
REGION="$DEFAULT_REGION"
UPSTREAM=""
SERVICE_MAP=""
AUTO_APPROVE="false"
UNIFIED="true"
SEPARATE="false"
SPEC_FILES=()

while [[ $# -gt 0 ]]; do
    case $1 in
        validate|generate|deploy|destroy|plan|status|logs|test|setup-cloud|clean)
            COMMAND="$1"
            shift
            ;;
        -s|--spec)
            SPEC_FILES+=("$2")
            shift 2
            ;;
        -o|--out)
            OUT_DIR="$2"
            shift 2
            ;;
        -t|--templates)
            TEMPLATES_DIR="$2"
            shift 2
            ;;
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -u|--upstream)
            UPSTREAM="$2"
            shift 2
            ;;
        --service-map)
            SERVICE_MAP="$2"
            shift 2
            ;;
        --unified)
            UNIFIED="true"
            SEPARATE="false"
            shift
            ;;
        --separate)
            SEPARATE="true"
            UNIFIED="false"
            shift
            ;;
        --auto-approve)
            AUTO_APPROVE="true"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Load environment variables if .env exists
if [ -f ".env" ]; then
    source .env
    # Override platform if specified in .env
    if [ -n "$PLATFORM" ] && [ "$PLATFORM" != "$DEFAULT_PLATFORM" ]; then
        log_info "Using platform from .env file: $PLATFORM"
        PLATFORM="$PLATFORM"
    fi
fi

# Validate and normalize platform
PLATFORM=$(validate_platform "$PLATFORM")

# Set platform-specific region variable
case "$PLATFORM" in
    aws)
        export AWS_REGION="$REGION"
        ;;
    gcp)
        export GCP_REGION="$REGION"
        ;;
    azure)
        export AZURE_REGION="$REGION"
        ;;
esac

# Main command execution
case "$COMMAND" in
    "")
        log_error "No command specified"
        show_help
        exit 1
        ;;
    setup-cloud)
        setup_cloud_credentials "$PLATFORM" "$REGION"
        ;;
    validate)
        if [ ${#SPEC_FILES[@]} -eq 0 ]; then
            log_error "Spec file(s) required for validate command"
            exit 1
        fi
        check_dependencies "$PLATFORM"
        validate_spec "${SPEC_FILES[@]}"
        ;;
    generate)
        if [ ${#SPEC_FILES[@]} -eq 0 ]; then
            log_error "Spec file(s) required for generate command"
            exit 1
        fi
        check_dependencies "$PLATFORM"
        generate_infrastructure "$OUT_DIR" "$TEMPLATES_DIR" "$PLATFORM" "$UPSTREAM" "$SERVICE_MAP" "${SPEC_FILES[@]}"
        ;;
    plan)
        check_dependencies "$PLATFORM"
        infrastructure_plan "$OUT_DIR" "$PLATFORM"
        ;;
    deploy)
        if [ ${#SPEC_FILES[@]} -eq 0 ]; then
            log_error "Spec file(s) required for deploy command"
            exit 1
        fi
        check_dependencies "$PLATFORM"
        generate_infrastructure "$OUT_DIR" "$TEMPLATES_DIR" "$PLATFORM" "$UPSTREAM" "$SERVICE_MAP" "${SPEC_FILES[@]}"
        deploy_infrastructure "$OUT_DIR" "$PLATFORM" "$AUTO_APPROVE"
        ;;
    destroy)
        check_dependencies "$PLATFORM"
        destroy_infrastructure "$OUT_DIR" "$PLATFORM" "$AUTO_APPROVE"
        ;;
    status)
        check_dependencies "$PLATFORM"
        get_deployment_status "$OUT_DIR" "$PLATFORM"
        ;;
    test)
        check_dependencies "$PLATFORM"
        test_api_endpoints "$OUT_DIR" "$PLATFORM"
        ;;
    clean)
        clean_generated_files "$OUT_DIR"
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac
