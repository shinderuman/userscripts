#!/bin/bash

# IP更新バッチスクリプト
# API Gatewayリソースポリシーを現在のIPアドレスで更新する

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/ip-update.log"
IP_CACHE_FILE="${SCRIPT_DIR}/.last_ip"
STACK_NAME="${STACK_NAME:-s3-asin-cleanup-api}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# エラーハンドリング
error_exit() {
    log "ERROR: $1"
    exit 1
}

# 現在のIPアドレスを取得
get_current_ip() {
    local ip
    log "現在のパブリックIPアドレスを取得中..."
    
    # checkip.amazonaws.comからIPを取得（タイムアウト10秒）
    if ! ip=$(curl -s --max-time 10 http://checkip.amazonaws.com); then
        error_exit "IPアドレスの取得に失敗しました"
    fi
    
    # IPアドレスの形式を検証
    if [[ ! $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        error_exit "無効なIPアドレス形式: $ip"
    fi
    
    echo "$ip"
}

# 前回のIPアドレスを取得
get_last_ip() {
    if [[ -f "$IP_CACHE_FILE" ]]; then
        cat "$IP_CACHE_FILE"
    else
        echo ""
    fi
}

# IPアドレスをキャッシュに保存
save_ip_cache() {
    local ip="$1"
    echo "$ip" > "$IP_CACHE_FILE"
}

# API Gateway IDを取得
get_api_gateway_id() {
    local api_id
    log "API Gateway IDを取得中..."
    
    if ! api_id=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`APIGatewayId`].OutputValue' \
        --output text 2>/dev/null); then
        error_exit "CloudFormationスタック '$STACK_NAME' からAPI Gateway IDの取得に失敗しました"
    fi
    
    if [[ -z "$api_id" || "$api_id" == "None" ]]; then
        error_exit "API Gateway IDが見つかりません。スタック '$STACK_NAME' を確認してください"
    fi
    
    echo "$api_id"
}

# リソースポリシーを更新
update_resource_policy() {
    local api_id="$1"
    local ip="$2"
    
    log "API Gateway リソースポリシーを更新中... (API ID: $api_id, IP: $ip)"
    
    # リソースポリシーのJSON作成
    local policy_json
    policy_json=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": "${ip}/32"
        }
      }
    }
  ]
}
EOF
)
    
    # API Gatewayリソースポリシーを更新
    if ! aws apigateway put-rest-api \
        --rest-api-id "$api_id" \
        --mode overwrite \
        --body "{\"policy\": $(echo "$policy_json" | jq -c .)}" \
        --region "$AWS_REGION" >/dev/null; then
        error_exit "API Gatewayリソースポリシーの更新に失敗しました"
    fi
    
    log "リソースポリシーの更新が完了しました"
}

# CloudFormationスタックのパラメータを更新
update_stack_parameter() {
    local ip="$1"
    
    log "CloudFormationスタックパラメータを更新中..."
    
    # 現在のスタックパラメータを取得
    local current_params
    if ! current_params=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Parameters' \
        --output json 2>/dev/null); then
        error_exit "現在のスタックパラメータの取得に失敗しました"
    fi
    
    # AllowedIPAddressパラメータを更新
    local updated_params
    updated_params=$(echo "$current_params" | jq --arg ip "${ip}/32" '
        map(if .ParameterKey == "AllowedIPAddress" then .ParameterValue = $ip else . end)
    ')
    
    # パラメータ形式をAWS CLI用に変換
    local cli_params
    cli_params=$(echo "$updated_params" | jq -r '.[] | "ParameterKey=\(.ParameterKey),ParameterValue=\(.ParameterValue)"' | tr '\n' ' ')
    
    # スタックを更新
    if ! aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --use-previous-template \
        --parameters $cli_params \
        --region "$AWS_REGION" >/dev/null; then
        # スタック更新が不要な場合のエラーをチェック
        local error_msg
        error_msg=$(aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --use-previous-template \
            --parameters $cli_params \
            --region "$AWS_REGION" 2>&1 || true)
        
        if [[ "$error_msg" == *"No updates are to be performed"* ]]; then
            log "スタックに変更はありません"
        else
            error_exit "CloudFormationスタックの更新に失敗しました: $error_msg"
        fi
    else
        log "CloudFormationスタックの更新を開始しました"
        
        # 更新完了を待機
        log "スタック更新の完了を待機中..."
        if ! aws cloudformation wait stack-update-complete \
            --stack-name "$STACK_NAME" \
            --region "$AWS_REGION"; then
            error_exit "スタック更新の完了待機中にエラーが発生しました"
        fi
        
        log "CloudFormationスタックの更新が完了しました"
    fi
}

# メイン処理
main() {
    log "=== IP更新バッチスクリプト開始 ==="
    
    # 必要なコマンドの存在確認
    for cmd in curl aws jq; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            error_exit "必要なコマンドが見つかりません: $cmd"
        fi
    done
    
    # 現在のIPアドレスを取得
    local current_ip
    current_ip=$(get_current_ip)
    log "現在のIPアドレス: $current_ip"
    
    # 前回のIPアドレスを取得
    local last_ip
    last_ip=$(get_last_ip)
    
    if [[ -n "$last_ip" ]]; then
        log "前回のIPアドレス: $last_ip"
        
        # IPアドレスが変更されていない場合はスキップ
        if [[ "$current_ip" == "$last_ip" ]]; then
            log "IPアドレスに変更はありません。更新をスキップします。"
            exit 0
        fi
    else
        log "前回のIPアドレスが記録されていません。初回実行として処理します。"
    fi
    
    # API Gateway IDを取得
    local api_id
    api_id=$(get_api_gateway_id)
    
    # CloudFormationスタックパラメータを更新
    update_stack_parameter "$current_ip"
    
    # IPアドレスをキャッシュに保存
    save_ip_cache "$current_ip"
    
    log "=== IP更新バッチスクリプト完了 ==="
    log "新しいIPアドレス: $current_ip でAPI Gatewayが更新されました"
}

# スクリプト実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi