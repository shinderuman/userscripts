# S3 ASIN Cleanup API - 次のステップ

## 概要
price and point highlighterへのS3 ASIN cleanup API統合が完了しました。
次に実行すべき作業を以下にまとめます。

## 完了済み作業
- ✅ Task 5.1: API呼び出し関数の実装
- ✅ Task 5.2: 通知送信処理との統合
- ✅ config.js.exampleへのS3 cleanup API設定追加

## 次に実行すべき作業

### 1. CloudFormationインフラストラクチャのデプロイ

#### 1.1 インフラストラクチャデプロイ
```bash
cd s3-asin-cleanup-api
./deploy-infrastructure.sh
```

**必要な情報:**
- S3バケット名（unprocessed_asins.jsonが保存されているバケット）
- S3オブジェクトキー（デフォルト: unprocessed_asins.json）

**出力される情報:**
- API Gateway URL
- Lambda関数名
- API Gateway ID

#### 1.2 API Gateway URLの取得と設定
デプロイ後、以下のコマンドでAPI Gateway URLを取得：
```bash
aws cloudformation describe-stacks \
    --stack-name s3-asin-cleanup-api \
    --query 'Stacks[0].Outputs[?OutputKey==`APIGatewayURL`].OutputValue' \
    --output text
```

取得したURLを`config.js`の`s3CleanupApi.endpoint`に設定。

### 2. Lambda関数のデプロイ

#### 2.1 Lambda関数コードのデプロイ
```bash
cd s3-asin-cleanup-api
./deploy-lambda.sh
```

#### 2.2 デプロイ検証
```bash
./validate-deployment.sh
```

### 3. API動作テスト

#### 3.1 Lambda関数の直接テスト
```bash
cd s3-asin-cleanup-api
echo '{"asin": "TEST123"}' > test-payload.json
aws lambda invoke \
    --function-name s3-asin-cleanup-api-asin-cleanup \
    --payload file://test-payload.json \
    response.json
cat response.json
```

#### 3.2 API Gateway経由のテスト
```bash
curl -X DELETE https://your-api-gateway-url/cleanup \
  -H "Content-Type: application/json" \
  -d '{"asin": "TEST123"}'
```

### 4. UserScript設定の更新

#### 4.1 config.jsの更新
1. 取得したAPI Gateway URLを`config.js`に設定
2. Tampermonkeyでスクリプトを再読み込み

#### 4.2 動作確認
1. Amazon.co.jpで条件を満たすKindle書籍ページを開く
2. 通知が送信されることを確認
3. S3からASINが削除されることを確認

### 5. IP更新の自動化（オプション）

#### 5.1 IP更新スクリプトの設定
```bash
cd s3-asin-cleanup-api
cp ip-update-config.sh.example ip-update-config.sh
# 設定を編集
```

#### 5.2 crontabでの自動実行設定
```bash
# 毎時0分に実行
0 * * * * cd /path/to/s3-asin-cleanup-api && source ip-update-config.sh && ./update-api-gateway-ip.sh
```

## 注意事項

### セキュリティ
- API GatewayはIPアドレス制限により保護されています
- 動的IPの場合は定期的にIP更新スクリプトを実行してください

### コスト
- Lambda関数は使用量ベースの課金です
- API Gatewayのリクエスト数に応じて課金されます
- CloudWatch Logsの保存期間を適切に設定してください

### モニタリング
- CloudWatch Logsでエラーログを監視
- Lambda関数のメトリクスを確認
- API Gatewayのアクセスログを有効化（必要に応じて）

## トラブルシューティング

### よくある問題
1. **403 Forbidden**: IPアドレス制限を確認
2. **Function not found**: Lambda関数名を確認
3. **Invalid JSON**: リクエスト形式を確認
4. **S3 Access Denied**: Lambda実行ロールの権限を確認

### ログの確認方法
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/s3-asin-cleanup"
aws logs tail /aws/lambda/s3-asin-cleanup-api-asin-cleanup --follow
```

## 参考資料
- [s3-asin-cleanup-api/README.md](s3-asin-cleanup-api/README.md)
- [.kiro/specs/s3-asin-cleanup-api/design.md](.kiro/specs/s3-asin-cleanup-api/design.md)
- [.kiro/specs/s3-asin-cleanup-api/requirements.md](.kiro/specs/s3-asin-cleanup-api/requirements.md)