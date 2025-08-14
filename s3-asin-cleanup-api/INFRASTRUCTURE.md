# S3 ASIN Cleanup API - Infrastructure

このドキュメントでは、S3 ASIN Cleanup APIのインフラストラクチャのデプロイと管理について説明します。

## 概要

CloudFormationテンプレート `s3-asin-cleanup-infrastructure.yaml` は以下のリソースを作成します：

- **API Gateway**: `/cleanup` エンドポイントを持つREST API
- **Lambda関数**: S3ファイルを更新するGo言語関数
- **IAMロール**: Lambda関数用の実行ロール（S3アクセス権限付き）
- **リソースポリシー**: 指定IPアドレスからのアクセスのみを許可

## デプロイ方法

### 1. 自動デプロイ（推奨）

```bash
./deploy-infrastructure.sh
```

このスクリプトは以下を自動実行します：
- 現在のIPアドレスを取得
- S3バケット名とオブジェクトキーの入力を求める
- CloudFormationスタックをデプロイ
- デプロイ結果を表示

### 2. 手動デプロイ

```bash
# 現在のIPアドレスを取得
CURRENT_IP=$(curl -s http://checkip.amazonaws.com)

# CloudFormationスタックをデプロイ
aws cloudformation deploy \
    --template-file s3-asin-cleanup-infrastructure.yaml \
    --stack-name s3-asin-cleanup-api \
    --parameter-overrides \
        AllowedIPAddress="$CURRENT_IP/32" \
        S3BucketName="your-bucket-name" \
        S3ObjectKey="unprocessed_asins.json" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region ap-northeast-1
```

## パラメータ

| パラメータ | 説明 | デフォルト値 |
|-----------|------|-------------|
| `AllowedIPAddress` | APIアクセスを許可するIPアドレス（CIDR形式） | `0.0.0.0/32` |
| `S3BucketName` | JSONファイルが格納されているS3バケット名 | `your-bucket-name` |
| `S3ObjectKey` | S3オブジェクトのキー | `unprocessed_asins.json` |

## 出力値

デプロイ完了後、以下の値が出力されます：

| 出力キー | 説明 |
|---------|------|
| `APIGatewayURL` | API GatewayのエンドポイントURL |
| `LambdaFunctionName` | Lambda関数名（デプロイスクリプト用） |
| `APIGatewayId` | API Gateway ID（IP更新スクリプト用） |

## IP更新

動的IPアドレス環境では、定期的にリソースポリシーを更新する必要があります：

```bash
# IP更新スクリプト（後で作成予定）
./update-api-gateway-ip.sh
```

## Lambda関数のデプロイ

CloudFormationテンプレートは空のLambda関数を作成します。実際のコードは別途デプロイが必要です：

```bash
# Lambda関数デプロイスクリプト（後で作成予定）
./deploy-lambda.sh
```

## トラブルシューティング

### デプロイエラー

1. **IAM権限不足**
   - CloudFormation、API Gateway、Lambda、IAMの権限が必要

2. **S3バケットアクセスエラー**
   - 指定したS3バケットが存在することを確認
   - Lambda実行ロールにS3アクセス権限があることを確認

3. **IP制限エラー**
   - 現在のIPアドレスが正しく設定されていることを確認
   - リソースポリシーが適切に適用されていることを確認

### スタック削除

```bash
aws cloudformation delete-stack \
    --stack-name s3-asin-cleanup-api \
    --region ap-northeast-1
```

## セキュリティ考慮事項

- API GatewayはIP制限により保護されています
- Lambda関数は最小権限の原則に従ったIAMロールを使用
- HTTPS通信のみを許可
- リクエスト検証により不正なデータを拒否

## 監視とログ

- CloudWatch Logsでログを確認可能
- API Gatewayのアクセスログが記録される
- Lambda関数の実行メトリクスを監視可能