#!/bin/bash

# Example environment configuration for S3 ASIN Cleanup Lambda
# Copy this file and modify the values according to your setup

# AWS Configuration
export AWS_REGION="ap-northeast-1"  # Tokyo region
export AWS_PROFILE="default"        # AWS CLI profile to use

# Lambda Function Configuration
export LAMBDA_FUNCTION_NAME="s3-asin-cleanup-lambda"

# S3 Configuration (these will be set as Lambda environment variables)
export S3_BUCKET_NAME="your-kindle-books-bucket"
export S3_OBJECT_KEY="kindle-books.json"

# Optional: Set these if you want to update Lambda environment variables during deployment
# export UPDATE_ENV_VARS="true"

echo "Environment variables configured for S3 ASIN Cleanup Lambda deployment"
echo "Bucket: $S3_BUCKET_NAME"
echo "Object: $S3_OBJECT_KEY"
echo "Function: $LAMBDA_FUNCTION_NAME"
echo "Region: $AWS_REGION"