# GitHub UserScripts

GitHub関連のUserScriptを提供します。

## スクリプト一覧

### Sale Wishlist Opener
- **ファイル**: `sale_wishlist_opener/`
- **機能**: セールになってほしい本.mdのリンクを日付フィルタリングで一括開き
- **対象URL**: `https://gist.github.com/shinderuman/571a55fc0f9e56156cae277ded0cf09c`
- **特徴**: 過去・今日以降・全件の3つのフィルタリングオプション

### New Release Checker
- **ファイル**: `new_release_checker/`
- **機能**: 新刊チェック中の作者.mdのリンクを基準日付で一括開き
- **対象URL**: `https://gist.github.com/shinderuman/d5116b8fdce5cdd1995c2a7a3be325f4`
- **特徴**: 日付入力フィールドで基準日を設定可能（デフォルトは現在日時）

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

### 使用方法

#### Sale Wishlist Opener
1. セールになってほしい本.mdのGistページを開く
2. 右側に表示されるパネルから希望するフィルタリングボタンをクリック
3. 条件に合致するリンクが新しいタブで一括開封

#### New Release Checker
1. 新刊チェック中の作者.mdのGistページを開く
2. 右側パネルの日付入力フィールドで基準日を設定
3. 「過去のリンクを開く」または「基準日以降のリンクを開く」をクリック
4. 日付条件に合致するリンクが新しいタブで一括開封

### 新機能追加
1. `github/[feature_name]/`ディレクトリを作成
2. `main.js`と`wrapper.js`を実装
3. 必要に応じて`common.js`に共通機能を追加