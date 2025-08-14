#!/bin/bash

# Lambda Deployment Script for S3 ASIN Cleanup API
# This script builds the Go Lambda function and deploys it to AWS

set -e  # Exit on any error

# Configuration
LAMBDA_FUNCTION_NAME="s3-asin-cleanup-lambda"
LAMBDA_DIR="lambda"
BUILD_DIR="build"
ZIP_FILE="lambda-deployment.zip"
BINARY_NAME="main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if required tools are installed
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed. Please install Go first."
        exit 1
    fi
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Check if zip is installed
    if ! command -v zip &> /dev/null; then
        print_error "zip command is not available. Please install zip utility."
        exit 1
    fi
    
    print_success "All prerequisites are available"
}

# Function to clean up previous build artifacts
cleanup_build() {
    print_info "Cleaning up previous build artifacts..."
    
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        print_info "Removed existing build directory"
    fi
    
    if [ -f "$ZIP_FILE" ]; then
        rm -f "$ZIP_FILE"
        print_info "Removed existing zip file"
    fi
}

# Function to build the Go binary
build_lambda() {
    print_info "Building Go Lambda function..."
    
    # Create build directory
    mkdir -p "$BUILD_DIR"
    
    # Change to lambda directory
    cd "$LAMBDA_DIR"
    
    # Build for Linux AMD64 (Lambda runtime environment)
    print_info "Compiling Go code for Linux AMD64..."
    GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o "../$BUILD_DIR/$BINARY_NAME" .
    
    if [ $? -ne 0 ]; then
        print_error "Failed to build Go binary"
        exit 1
    fi
    
    # Return to parent directory
    cd ..
    
    print_success "Go binary built successfully"
}

# Function to create deployment package
create_deployment_package() {
    print_info "Creating deployment package..."
    
    # Change to build directory
    cd "$BUILD_DIR"
    
    # Create zip file with the binary
    zip -r "../$ZIP_FILE" "$BINARY_NAME"
    
    if [ $? -ne 0 ]; then
        print_error "Failed to create zip file"
        exit 1
    fi
    
    # Return to parent directory
    cd ..
    
    # Check zip file size
    ZIP_SIZE=$(stat -f%z "$ZIP_FILE" 2>/dev/null || stat -c%s "$ZIP_FILE" 2>/dev/null)
    ZIP_SIZE_MB=$((ZIP_SIZE / 1024 / 1024))
    
    print_success "Deployment package created: $ZIP_FILE (${ZIP_SIZE_MB}MB)"
    
    # Warn if zip file is large
    if [ $ZIP_SIZE_MB -gt 50 ]; then
        print_error "Warning: Deployment package is larger than 50MB. Lambda has size limits."
    fi
}

# Function to check if Lambda function exists
check_lambda_function() {
    print_info "Checking if Lambda function exists..."
    
    aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" &> /dev/null
    return $?
}

# Function to update environment variables
update_environment_variables() {
    if [ "$UPDATE_ENV_VARS" = "true" ] && [ -n "$S3_BUCKET_NAME" ] && [ -n "$S3_OBJECT_KEY" ]; then
        print_info "Updating Lambda environment variables..."
        
        aws lambda update-function-configuration \
            --function-name "$LAMBDA_FUNCTION_NAME" \
            --environment "Variables={S3_BUCKET_NAME=$S3_BUCKET_NAME,S3_OBJECT_KEY=$S3_OBJECT_KEY}" \
            --output table
        
        if [ $? -ne 0 ]; then
            print_error "Failed to update environment variables"
            exit 1
        fi
        
        print_success "Environment variables updated successfully"
    fi
}

# Function to deploy Lambda function
deploy_lambda() {
    print_info "Deploying Lambda function..."
    
    # Check if function exists
    if check_lambda_function; then
        print_info "Lambda function exists. Updating function code..."
        
        # Update existing function
        aws lambda update-function-code \
            --function-name "$LAMBDA_FUNCTION_NAME" \
            --zip-file "fileb://$ZIP_FILE" \
            --output table
        
        if [ $? -ne 0 ]; then
            print_error "Failed to update Lambda function code"
            exit 1
        fi
        
        print_success "Lambda function code updated successfully"
        
        # Update environment variables if requested
        update_environment_variables
    else
        print_error "Lambda function '$LAMBDA_FUNCTION_NAME' does not exist."
        print_error "Please create the function using CloudFormation first."
        exit 1
    fi
}

# Function to verify deployment
verify_deployment() {
    print_info "Verifying deployment..."
    
    # Get function configuration
    FUNCTION_INFO=$(aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --output json)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to get function information"
        exit 1
    fi
    
    # Extract key information
    RUNTIME=$(echo "$FUNCTION_INFO" | grep -o '"Runtime": "[^"]*"' | cut -d'"' -f4)
    LAST_MODIFIED=$(echo "$FUNCTION_INFO" | grep -o '"LastModified": "[^"]*"' | cut -d'"' -f4)
    CODE_SIZE=$(echo "$FUNCTION_INFO" | grep -o '"CodeSize": [0-9]*' | cut -d':' -f2 | tr -d ' ')
    
    print_success "Deployment verification:"
    echo "  Function Name: $LAMBDA_FUNCTION_NAME"
    echo "  Runtime: $RUNTIME"
    echo "  Last Modified: $LAST_MODIFIED"
    echo "  Code Size: $CODE_SIZE bytes"
}

# Function to test Lambda function (optional)
test_lambda() {
    print_info "Testing Lambda function with sample payload..."
    
    # Create test payload
    TEST_PAYLOAD='{"asin": "TEST123"}'
    
    # Invoke function
    aws lambda invoke \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --payload "$TEST_PAYLOAD" \
        --output json \
        response.json
    
    if [ $? -eq 0 ]; then
        print_success "Test invocation completed. Check response.json for results."
        if [ -f "response.json" ]; then
            echo "Response content:"
            cat response.json
            echo ""
        fi
    else
        print_error "Test invocation failed"
    fi
}

# Main execution
main() {
    print_info "Starting Lambda deployment process..."
    
    # Check if we're in the right directory
    if [ ! -d "$LAMBDA_DIR" ]; then
        print_error "Lambda directory '$LAMBDA_DIR' not found. Please run this script from the project root."
        exit 1
    fi
    
    # Execute deployment steps
    check_prerequisites
    cleanup_build
    build_lambda
    create_deployment_package
    deploy_lambda
    verify_deployment
    
    # Ask if user wants to run test
    echo ""
    read -p "Do you want to test the deployed function? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        test_lambda
    fi
    
    # Cleanup build artifacts
    print_info "Cleaning up build artifacts..."
    rm -rf "$BUILD_DIR"
    rm -f "$ZIP_FILE"
    rm -f "response.json"
    
    print_success "Lambda deployment completed successfully!"
    print_info "Function '$LAMBDA_FUNCTION_NAME' is ready to use."
}

# Handle script interruption
trap 'print_error "Script interrupted. Cleaning up..."; rm -rf "$BUILD_DIR" "$ZIP_FILE" "response.json"; exit 1' INT TERM

# Run main function
main "$@"