#!/bin/bash

# IP更新バッチスクリプト用設定ファイル
# このファイルをsourceして環境変数を設定してください
# 例: source ip-update-config.sh && ./update-api-gateway-ip.sh

# CloudFormationスタック名
export STACK_NAME="s3-asin-cleanup-api"

# AWSリージョン
export AWS_REGION="ap-northeast-1"

# AWSプロファイル（必要に応じて設定）
# export AWS_PROFILE="your-profile-name"

echo "IP更新バッチスクリプト用環境変数を設定しました:"
echo "  STACK_NAME: $STACK_NAME"
echo "  AWS_REGION: $AWS_REGION"
echo ""
echo "使用方法:"
echo "  source ip-update-config.sh && ./update-api-gateway-ip.sh"