# UserScripts Collection

このリポジトリは、様々なWebサービスの自動化を行うTampermonkeyユーザースクリプトのコレクションです。

## 📁 プロジェクト構造

```
userscripts/
├── README.md                    # このファイル
├── LICENSE                      # MITライセンス
├── kindle/                      # Amazon Kindle関連スクリプト
│   ├── README.md               # Kindleスクリプトの詳細説明
│   ├── common.js               # 共通ライブラリ
│   ├── new_release_checker/    # 新刊チェッカー
│   ├── paper_to_kindle_checker/ # 紙書籍→Kindle版チェッカー
│   ├── sale_checker/           # セールチェッカー
│   ├── campaign_sorter/        # キャンペーン商品抽出
│   └── manga_first_open_page/  # マンガ最初のページ開く
├── amazon/                      # Amazon関連スクリプト
│   ├── README.md               # Amazonスクリプトの詳細説明
│   ├── common.js               # 共通ライブラリ
│   ├── highlight/              # ウィッシュリストハイライト
│   └── affiliate_tag_adder/    # アフィリエイトタグ自動追加
└── mastodon/                    # Mastodon関連スクリプト
    ├── README.md               # Mastodonスクリプトの詳細説明
    ├── common.js               # 共通ライブラリ
    ├── column_splitter/        # カラム分割
    ├── column_combiner/        # カラム結合
    └── recent_post_editor/     # 投稿編集ショートカット
```

## 🎯 対応サービス

### 現在対応済み
- **Amazon Kindle** (`kindle/`) - 書籍の新刊・セール・利用可能性チェック
- **Amazon** (`amazon/`) - ウィッシュリストハイライト・アフィリエイトタグ自動追加
- **Mastodon** (`mastodon/`) - カラム管理・投稿編集・UI改善

### 今後追加予定
- その他のECサイト
- 各種Webサービス
- SNSプラットフォーム

## 🚀 使用方法

1. **Tampermonkey拡張機能**をブラウザにインストール
2. 使用したいサービスのディレクトリから`wrapper.js`ファイルをTampermonkeyにインポート
3. 対象サイトでスクリプトを実行

## 📚 利用可能なスクリプト

### Amazon Kindle (`kindle/`)

- **新刊チェッカー**: 指定作者の新刊をチェックして通知
- **紙書籍→Kindle版チェッカー**: 紙書籍とKindle版両方が利用可能な商品を発見
- **セールチェッカー**: ウィッシュリストの書籍のセール情報をチェック
- **キャンペーン商品抽出**: 期間限定キャンペーン対象商品を価格順で表示
- **マンガ最初のページ開く**: Kindle Cloud Readerで最初のページを開く

### Amazon (`amazon/`)

- **ウィッシュリストハイライト**: 特定条件のアイテムをハイライト表示
- **アフィリエイトタグ自動追加**: ペースト時にAmazonリンクにタグを自動追加

### Mastodon (`mastodon/`)

- **カラム分割**: 指定カラムを複数に分割してレイアウト改善
- **カラム結合**: 複数カラムを縦方向に結合
- **投稿編集ショートカット**: キーボードショートカットで投稿編集・リプライ

詳細は各サービスディレクトリ内の`README.md`を参照してください。

## 🛠️ 開発

### アーキテクチャ

- **サービス別分離**: 各サービス毎にディレクトリを分割
- **モジュラー設計**: 共通機能は各サービスの`common.js`に集約
- **分離された責任**: 各スクリプトは特定の機能に特化
- **再利用可能**: 共通ライブラリによる効率的な開発

### ファイル構成

- `[service]/`: サービス別ディレクトリ
- `main.js`: スクリプトのメインロジック
- `wrapper.js`: Tampermonkey用のUserScriptヘッダー
- `common.js`: サービス内で共有される汎用機能

### 新しいサービスの追加

1. 新しいサービス用ディレクトリを作成
2. `common.js`でサービス固有の共通機能を実装
3. 各機能毎に`main.js`と`wrapper.js`を作成
4. サービス用`README.md`で詳細を説明

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 👤 作者

shinderuman