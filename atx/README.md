# AT-X UserScripts

AT-Xの番組表ページ用UserScriptコレクション

## 対応サービス

### Program Time Indicator
- **機能**: 週間番組表の現在時刻の時間セルと本日の曜日のヘッダーをハイライト
- **対象URL**: `https://www.at-x.com/program*`
- **使用方法**: 番組表ページを開くと自動的に実行される

## インストール方法

1. Tampermonkeyで各機能の`wrapper.js`ファイルを開く
2. スクリプトをインストール
3. AT-Xの番組表ページでスクリプトが自動実行される

## 開発・カスタマイズ

各機能は以下の構成になっています：
- `main.js`: メインロジック
- `wrapper.js`: Tampermonkey用ヘッダー
- `common.js`: AT-X共通ライブラリ

設定やセレクターの変更は各`main.js`ファイルを編集してください。
