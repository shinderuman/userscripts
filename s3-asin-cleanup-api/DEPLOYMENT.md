# Lambda Deployment Guide

このドキュメントでは、S3 ASIN Cleanup Lambda関数のデプロイ方法について説明します。

## 前提条件

以下のツールがインストールされている必要があります：

- Go (1.22以上)
- AWS CLI (設定済み)
- zip コマンド

## 環境設定

1. 環境変数ファイルをコピーして設定：

```bash
cp example-env.sh env.sh
```

2. `env.sh`を編集して、あなたの環境に合わせて設定：

```bash
# AWS Configuration
export AWS_REGION="ap-northeast-1"
export AWS_PROFILE="your-profile"

# Lambda Function Configuration
export LAMBDA_FUNCTION_NAME="s3-asin-cleanup-lambda"

# S3 Configuration
export S3_BUCKET_NAME="your-kindle-books-bucket"
export S3_OBJECT_KEY="unprocessed_asins.json"

# Optional: Lambda環境変数を更新する場合
export UPDATE_ENV_VARS="true"
```

3. 環境変数を読み込み：

```bash
source env.sh
```

## デプロイ手順

### 1. インフラストラクチャのデプロイ（初回のみ）

```bash
./deploy-infrastructure.sh
```

### 2. Lambda関数のデプロイ

```bash
./deploy-lambda.sh
```

## デプロイスクリプトの機能

`deploy-lambda.sh`スクリプトは以下の処理を自動で実行します：

1. **前提条件チェック**: Go、AWS CLI、zipコマンドの存在確認
2. **ビルドアーティファクトのクリーンアップ**: 前回のビルド結果を削除
3. **Go言語バイナリのビルド**: Linux AMD64用にクロスコンパイル
4. **デプロイパッケージの作成**: バイナリをzipファイルにパッケージング
5. **Lambda関数の更新**: AWS CLIを使用してコードを更新
6. **環境変数の更新**（オプション）: S3設定を Lambda環境変数に設定
7. **デプロイの検証**: 関数情報の表示と確認
8. **テスト実行**（オプション）: サンプルペイロードでの動作確認
9. **クリーンアップ**: 一時ファイルの削除

## トラブルシューティング

### よくあるエラー

1. **Lambda関数が存在しない**
   ```
   Lambda function 'function-name' does not exist.
   Please create the function using CloudFormation first.
   ```
   → 先にCloudFormationテンプレートをデプロイしてください

2. **AWS認証エラー**
   ```
   Unable to locate credentials
   ```
   → AWS CLIの設定を確認してください（`aws configure`）

3. **Go言語ビルドエラー**
   ```
   Failed to build Go binary
   ```
   → Go言語のバージョンとdependenciesを確認してください

### ログの確認

デプロイ後、Lambda関数のログはCloudWatch Logsで確認できます：

```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/s3-asin-cleanup-lambda"
```

## 手動テスト

デプロイ後、以下のコマンドで手動テストが可能です：

```bash
aws lambda invoke \
  --function-name s3-asin-cleanup-lambda \
  --payload '{"asin": "TEST123"}' \
  response.json

cat response.json
```

## 継続的デプロイメント

コードを変更した場合は、以下のコマンドで簡単に再デプロイできます：

```bash
./deploy-lambda.sh
```

インフラストラクチャの変更が必要な場合のみ、CloudFormationテンプレートを再デプロイしてください。