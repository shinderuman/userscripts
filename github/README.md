# GitHub UserScripts

GitHub関連のUserScriptを提供します。

## スクリプト一覧

### Gist Link Opener
- **ファイル**: `gist_link_opener/`
- **機能**: GitHub Gistページで日付フィルタリング機能付きのリンク一括開きボタンを表示
- **対象URL**: `https://gist.github.com/shinderuman/571a55fc0f9e56156cae277ded0cf09c`

## 共通ライブラリ

### GitHubCommon API

#### UI関連
- `createButton(label, onClick, styles = {})`: スタイル付きボタンを作成
- `createContainer(styles = {})`: フローティングコンテナを作成

#### 日付関連
- `parseDate(text)`: テキストから日付を抽出・パース
- `compareDates(date1, date2)`: 日付比較

## インストール方法

1. Tampermonkeyをブラウザにインストール
2. 各機能の`wrapper.js`をTampermonkeyに追加
3. 対象サイトにアクセスして動作確認

## 使用方法

### Gist Link Opener
1. 対象のGistページにアクセス
2. 右側に表示される3つのボタンを使用：
   - **過去のリンクを開く**: 今日より前の日付のリンクを開く
   - **今日以降のリンクを開く**: 今日以降の日付のリンクを開く
   - **すべてのリンクを開く**: 全てのリンクを開く

### ログ出力
- コンソールに処理状況が出力されます
- エラーが発生した場合は詳細情報が表示されます

## 開発・カスタマイズ

### スキップリスト設定
`gist_link_opener/main.js`の`skipList`配列を編集してスキップしたいキーワードを追加できます。

### スタイルカスタマイズ
`GitHubCommon.createButton()`や`GitHubCommon.createContainer()`の引数でスタイルをカスタマイズできます。

### 新機能追加
1. `github/[feature_name]/`ディレクトリを作成
2. `main.js`と`wrapper.js`を実装
3. 必要に応じて`common.js`に共通機能を追加