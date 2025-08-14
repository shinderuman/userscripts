#!/bin/bash

# IP更新バッチスクリプトのテスト用スクリプト
# 実際のAWS更新は行わず、IP取得とロジックのテストのみ実行

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== IP更新バッチスクリプト テスト ==="

# 必要なコマンドの存在確認
echo "1. 必要なコマンドの確認..."
for cmd in curl jq; do
    if command -v "$cmd" >/dev/null 2>&1; then
        echo "  ✓ $cmd: 利用可能"
    else
        echo "  ✗ $cmd: 見つかりません"
        exit 1
    fi
done

# IP取得テスト
echo ""
echo "2. IP取得テスト..."
if current_ip=$(curl -s --max-time 10 http://checkip.amazonaws.com); then
    echo "  ✓ 現在のIP: $current_ip"
    
    # IPアドレス形式の検証
    if [[ $current_ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "  ✓ IPアドレス形式: 有効"
    else
        echo "  ✗ IPアドレス形式: 無効"
        exit 1
    fi
else
    echo "  ✗ IP取得に失敗"
    exit 1
fi

# キャッシュファイルテスト
echo ""
echo "3. キャッシュファイルテスト..."
cache_file="${SCRIPT_DIR}/.test_ip_cache"
test_ip="192.168.1.100"

# キャッシュ書き込みテスト
echo "$test_ip" > "$cache_file"
if [[ -f "$cache_file" ]]; then
    echo "  ✓ キャッシュファイル作成: 成功"
    
    # キャッシュ読み取りテスト
    if cached_ip=$(cat "$cache_file"); then
        echo "  ✓ キャッシュファイル読み取り: $cached_ip"
        
        if [[ "$cached_ip" == "$test_ip" ]]; then
            echo "  ✓ キャッシュデータ整合性: 正常"
        else
            echo "  ✗ キャッシュデータ整合性: 異常"
            exit 1
        fi
    else
        echo "  ✗ キャッシュファイル読み取り: 失敗"
        exit 1
    fi
    
    # テストファイル削除
    rm -f "$cache_file"
    echo "  ✓ テストファイル削除: 完了"
else
    echo "  ✗ キャッシュファイル作成: 失敗"
    exit 1
fi

# JSONポリシー生成テスト
echo ""
echo "4. リソースポリシーJSON生成テスト..."
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
          "aws:SourceIp": "${current_ip}/32"
        }
      }
    }
  ]
}
EOF
)

if echo "$policy_json" | jq . >/dev/null 2>&1; then
    echo "  ✓ JSONポリシー生成: 成功"
    echo "  ✓ JSON形式検証: 有効"
else
    echo "  ✗ JSONポリシー生成: 失敗"
    exit 1
fi

echo ""
echo "=== テスト完了 ==="
echo "すべてのテストが正常に完了しました。"
echo ""
echo "実際のAWS更新を実行するには:"
echo "  source ip-update-config.sh && ./update-api-gateway-ip.sh"