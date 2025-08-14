# S3 ASIN クリーンアップ API

S3に保存されたKindle書籍JSONファイルからASINエントリを削除するAWS Lambda関数です。

## 概要

このLambda関数は、Amazon S3に保存されたKindle書籍データを含むJSONファイルから特定のASIN（Amazon Standard Identification Number）エントリを削除するAPIエンドポイントを提供します。

## アーキテクチャ

- **ランタイム**: Go 1.22
- **トリガー**: API Gateway (HTTP POST)
- **ストレージ**: Amazon S3
- **リージョン**: ap-northeast-1 (東京)

## 前提条件

デプロイする前に、以下が準備されていることを確認してください：

1. **Go 1.22+** がインストールされていること
2. **AWS CLI** が適切な認証情報で設定されていること
3. **zip** ユーティリティが利用可能であること
4. **Lambda関数がAWSで作成済み** であること（CloudFormationまたはAWSコンソール経由）

### 必要なAWS権限

Lambda実行ロールには以下の権限が必要です：
- 対象S3バケット/オブジェクトに対する `s3:GetObject`
- 対象S3バケット/オブジェクトに対する `s3:PutObject`
- 基本的なLambda実行権限

### 環境変数

Lambda関数には以下の環境変数が必要です：
- `S3_BUCKET_NAME`: JSONファイルを含むS3バケット名
- `S3_OBJECT_KEY`: バケット内のJSONファイルのキー（パス）

## IP更新バッチスクリプト

API GatewayはIPアドレス制限によりセキュリティが確保されています。動的IPアドレス環境からアクセスするため、定期的にリソースポリシーを更新する必要があります。

### IP更新スクリプトの使用

```bash
# 設定ファイルを読み込んでスクリプトを実行
source ip-update-config.sh && ./update-api-gateway-ip.sh
```

### 機能

- `checkip.amazonaws.com`から現在のパブリックIPアドレスを取得
- 前回のIPアドレスと比較し、変更がある場合のみ更新を実行
- CloudFormationスタックパラメータの更新
- API Gatewayリソースポリシーの更新
- 操作ログの記録（`ip-update.log`）

### 設定

`ip-update-config.sh`ファイルで以下の環境変数を設定：

- `STACK_NAME`: CloudFormationスタック名（デフォルト: `s3-asin-cleanup-api`）
- `AWS_REGION`: AWSリージョン（デフォルト: `ap-northeast-1`）
- `AWS_PROFILE`: AWSプロファイル（オプション）

### テスト

実際のAWS更新を行わずにスクリプトの動作をテスト：

```bash
./test-ip-update.sh
```

### 自動化

crontabを使用して定期実行を設定：

```bash
# 毎時0分に実行
0 * * * * cd /path/to/s3-asin-cleanup-api && source ip-update-config.sh && ./update-api-gateway-ip.sh
```

## デプロイ

### デプロイスクリプトの使用

最も簡単なデプロイ方法は、提供されているデプロイスクリプトを使用することです：

```bash
# プロジェクトルートディレクトリにいることを確認
./deploy-lambda.sh
```

スクリプトは以下を実行します：
1. 前提条件のチェック（Go、AWS CLI、zip）
2. 以前のビルド成果物のクリーンアップ
3. Linux AMD64用のGoバイナリのビルド
4. デプロイ用ZIPパッケージの作成
5. AWS CLIを使用したAWS Lambdaへのデプロイ
6. デプロイの検証
7. オプションで関数のテスト

### 手動デプロイ

手動でデプロイする場合：

```bash
# Linux用にビルド
cd lambda
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o main .

# デプロイパッケージの作成
zip lambda-deployment.zip main

# AWS CLIを使用してデプロイ
aws lambda update-function-code \
    --function-name s3-asin-cleanup-lambda \
    --zip-file fileb://lambda-deployment.zip
```

## API使用方法

### リクエスト形式

```http
POST /cleanup
Content-Type: application/json

{
  "asin": "B01234567X"
}
```

### レスポンス形式

#### 成功 (200)
```json
{
  "message": "ASIN B01234567X removed successfully",
  "remainingCount": 42
}
```

#### ASIN未発見 (404)
```json
{
  "message": "ASIN not found"
}
```

#### エラー (400/500)
```json
{
  "message": "Error description"
}
```

## テスト

### ローカルテスト

AWS CLIを使用して関数をローカルでテストできます：

```bash
# テストペイロードの作成
echo '{"asin": "TEST123"}' > test-payload.json

# 関数の呼び出し
aws lambda invoke \
    --function-name s3-asin-cleanup-lambda \
    --payload file://test-payload.json \
    response.json

# レスポンスの確認
cat response.json
```

### 統合テスト

実際のAPI Gatewayエンドポイントでテスト：

```bash
curl -X POST https://your-api-gateway-url/cleanup \
  -H "Content-Type: application/json" \
  -d '{"asin": "B01234567X"}'
```

## JSONファイル形式

S3 JSONファイルはKindle書籍オブジェクトの配列を含む必要があります：

```json
[
  {
    "ASIN": "B01234567X",
    "Title": "Example Book Title",
    "ReleaseDate": "2024-01-01T00:00:00Z",
    "CurrentPrice": 9.99,
    "MaxPrice": 12.99,
    "URL": "https://amazon.com/dp/B01234567X"
  }
]
```

## エラーハンドリング

関数には以下の包括的なエラーハンドリングが含まれています：
- リクエスト内のASINの欠落または無効
- S3アクセスエラー（権限、ファイル未発見）
- JSON解析エラー
- AWSサービスエラー

すべてのエラーは適切な詳細レベルでCloudWatch Logsに記録されます。

## モニタリング

以下を使用して関数を監視します：
- **CloudWatch Logs**: 関数実行ログ
- **CloudWatch Metrics**: 呼び出し回数、実行時間、エラー
- **X-Ray**: 分散トレーシング（有効化されている場合）

## 開発

### プロジェクト構造

```
s3-asin-cleanup-api/
├── lambda/
│   ├── main.go                    # Lambda関数コード
│   ├── go.mod                     # Goモジュール定義
│   └── go.sum                     # Goモジュールチェックサム
├── deploy-lambda.sh               # Lambdaデプロイスクリプト
├── deploy-infrastructure.sh       # インフラデプロイスクリプト
├── update-api-gateway-ip.sh       # IP更新バッチスクリプト
├── ip-update-config.sh           # IP更新スクリプト設定
├── test-ip-update.sh             # IP更新スクリプトテスト
├── s3-asin-cleanup-infrastructure.yaml  # CloudFormationテンプレート
├── example-env.sh                # 環境変数設定例
└── README.md                     # このファイル
```

### ローカルビルド

```bash
cd lambda
go mod tidy
go build -o main .
```

### テストの実行

```bash
cd lambda
go test ./...
```

## トラブルシューティング

### よくある問題

1. **"Function not found" エラー**
   - Lambda関数がAWSに存在することを確認
   - デプロイスクリプト内の関数名を確認

2. **"Access denied" エラー**
   - AWS CLI認証情報を確認
   - Lambda実行ロールの権限を確認
   - S3バケットの権限を確認

3. **"Invalid JSON" エラー**
   - S3ファイル形式が期待される構造と一致することを確認
   - ソースファイルのJSON構文エラーを確認

4. **ビルド失敗**
   - Go 1.22+がインストールされていることを確認
   - `go mod tidy`を実行して依存関係を解決
   - Goコードの構文エラーを確認

### ログ

詳細なエラー情報についてはCloudWatch Logsを確認してください：

```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/s3-asin-cleanup"
```

## セキュリティ考慮事項

- 最小権限のIAMポリシーを使用
- APIアクセスログのためのCloudTrailを有効化
- セキュリティ強化のためのVPC設定を検討
- AWS認証情報の定期的なローテーション
- 異常なアクセスパターンの監視

## コスト最適化

- 関数は最小限のメモリ使用量に最適化
- 効率的なGoコードによりコールドスタート時間を最小化
- 高トラフィックシナリオではプロビジョニング済み同時実行を検討
- AWS Cost Explorerを通じてコストを監視