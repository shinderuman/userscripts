#!/bin/bash

# S3 ASIN Cleanup API - Infrastructure Deployment Script

set -e

# Configuration
STACK_NAME="s3-asin-cleanup-api"
TEMPLATE_FILE="s3-asin-cleanup-infrastructure.yaml"
REGION="ap-northeast-1"

# Get current IP address
echo "Getting current IP address..."
CURRENT_IP=$(curl -s http://checkip.amazonaws.com)
if [ -z "$CURRENT_IP" ]; then
    echo "Error: Could not retrieve current IP address"
    exit 1
fi
echo "Current IP: $CURRENT_IP"

# Prompt for S3 bucket name
read -p "Enter S3 bucket name: " S3_BUCKET
if [ -z "$S3_BUCKET" ]; then
    echo "Error: S3 bucket name is required"
    exit 1
fi

# Prompt for S3 object key (default: unprocessed_asins.json)
read -p "Enter S3 object key [unprocessed_asins.json]: " S3_OBJECT_KEY
S3_OBJECT_KEY=${S3_OBJECT_KEY:-unprocessed_asins.json}

echo "Deploying CloudFormation stack..."
echo "Stack Name: $STACK_NAME"
echo "Template: $TEMPLATE_FILE"
echo "Region: $REGION"
echo "Allowed IP: $CURRENT_IP/32"
echo "S3 Bucket: $S3_BUCKET"
echo "S3 Object Key: $S3_OBJECT_KEY"

# Deploy the stack
aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
        AllowedIPAddress="$CURRENT_IP/32" \
        S3BucketName="$S3_BUCKET" \
        S3ObjectKey="$S3_OBJECT_KEY" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION"

if [ $? -eq 0 ]; then
    echo "Stack deployment completed successfully!"
    
    # Get stack outputs
    echo "Getting stack outputs..."
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table
else
    echo "Stack deployment failed!"
    exit 1
fi