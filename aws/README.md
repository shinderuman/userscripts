# AWS UserScripts

AWSコンソール用のUserScriptコレクション

## 対応サービス

### CloudWatch Dashboard Refresh
- **機能**: キーボードの'r'キーでダッシュボードをリフレッシュ
- **対象URL**: `https://*.console.aws.amazon.com/cloudwatch/home?region=*#dashboards/dashboard/*`
- **使用方法**: CloudWatchダッシュボード画面で'r'キーを押すとリフレッシュボタンがクリックされる

## インストール方法

1. Tampermonkeyで各機能の`wrapper.js`ファイルを開く
2. スクリプトをインストール
3. 対象のAWSコンソール画面でスクリプトが自動実行される

## 開発・カスタマイズ

各機能は以下の構成になっています：
- `main.js`: メインロジック（URL制限やキーイベント処理を含む）
- `wrapper.js`: Tampermonkey用ヘッダー
- `common.js`: AWS共通ライブラリ（将来的な拡張用）

設定やセレクターの変更は各`main.js`ファイルを編集してください。