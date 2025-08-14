#!/bin/bash

# Validation script for Lambda deployment
# This script validates the deployment setup without actually deploying

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info "Validating deployment setup..."

# Check if we're in the right directory
if [ ! -d "lambda" ]; then
    print_error "Lambda directory not found. Please run from project root."
    exit 1
fi

# Check if main.go exists
if [ ! -f "lambda/main.go" ]; then
    print_error "lambda/main.go not found"
    exit 1
fi

# Check if go.mod exists
if [ ! -f "lambda/go.mod" ]; then
    print_error "lambda/go.mod not found"
    exit 1
fi

# Check if deployment script exists and is executable
if [ ! -x "deploy-lambda.sh" ]; then
    print_error "deploy-lambda.sh not found or not executable"
    exit 1
fi

# Validate Go syntax
print_info "Validating Go syntax..."
if ! go -C lambda fmt -n . > /dev/null 2>&1; then
    print_error "Go syntax validation failed"
    exit 1
fi

# Check if Go can build (without actually building)
print_info "Checking Go build dependencies..."
if ! go -C lambda mod verify > /dev/null 2>&1; then
    print_error "Go module verification failed"
    exit 1
fi

# Test build (dry run)
print_info "Testing Go build process..."
if ! GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go -C lambda build -o /dev/null . > /dev/null 2>&1; then
    print_error "Go build test failed"
    exit 1
fi

print_success "All validation checks passed!"
print_info "Deployment script is ready to use."
print_info "Run './deploy-lambda.sh' to deploy the Lambda function."