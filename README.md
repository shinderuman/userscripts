# UserScripts Collection

このリポジトリは、様々なWebサービスの自動化を行うTampermonkeyユーザースクリプトのコレクションです。

## 📁 プロジェクト構造

```
userscripts/
├── README.md                           # このファイル
├── LICENSE                             # MITライセンス
├── kindle/                             # Amazon Kindle関連スクリプト
│   ├── README.md                      # Kindleスクリプトの詳細説明
│   ├── common.js                      # 共通ライブラリ
│   ├── new_release_checker/           # 新刊チェッカー
│   ├── paper_to_kindle_checker/       # 紙書籍→Kindle版チェッカー
│   ├── sale_checker/                  # セールチェッカー
│   ├── campaign_sorter/               # キャンペーン商品抽出
│   ├── deleted_item_checker/          # 削除商品チェッカー
│   ├── manga_first_open_page/         # マンガ最初のページ開く
│   └── reader_key_remap/              # Amazon Readerキーリマップ
├── amazon/                             # Amazon関連スクリプト
│   ├── README.md                      # Amazonスクリプトの詳細説明
│   ├── common.js                      # 共通ライブラリ
│   ├── highlight/                     # ウィッシュリストハイライト
│   └── affiliate_tag_adder/           # アフィリエイトタグ自動追加
├── dmm/                               # DMM関連スクリプト
│   ├── common.js                      # 共通ライブラリ
│   └── video_tab_opener/              # 動画タブオープナー
├── universal/                          # 汎用スクリプト
│   ├── common.js                      # 共通ライブラリ
│   ├── element_blur_toggle/           # 要素ぼかし切り替え
│   └── multi_site_keybind_manager/    # マルチサイトキーバインド管理
├── niconico/                          # ニコニコ動画関連スクリプト
│   ├── common.js                      # 共通ライブラリ
│   ├── vertical_to_horizontal_reader/ # 縦読み→横読み変換
│   ├── video_series_navigation/       # シリーズナビゲーション
│   └── auto_campaign_navigator/       # 自動キャンペーンナビゲーター
├── twitter/                           # Twitter/X関連スクリプト
│   ├── common.js                      # 共通ライブラリ
│   ├── tweet_intent_clipboard/        # ツイートインテント クリップボード
│   └── current_user_filter/           # 現在ユーザーフィルター
├── youtube/                           # YouTube関連スクリプト
│   ├── common.js                      # 共通ライブラリ
│   └── subscription_layout_optimizer/ # 登録チャンネル レイアウト最適化
├── mastodon/                          # Mastodon関連スクリプト
│   ├── README.md                      # Mastodonスクリプトの詳細説明
│   ├── common.js                      # 共通ライブラリ
│   ├── column_splitter/               # カラム分割
│   ├── column_combiner/               # カラム結合
│   ├── recent_post_editor/            # 投稿編集ショートカット
│   └── ai_post_blur_toggle/           # AI投稿ぼかし切り替え
└── github/                            # GitHub関連スクリプト
    ├── README.md                      # GitHubスクリプトの詳細説明
    ├── common.js                      # 共通ライブラリ
    └── gist_link_opener/              # Gistリンクオープナー
```

## 🎯 対応サービス

### 現在対応済み
- **Amazon Kindle** (`kindle/`) - 書籍の新刊・セール・利用可能性チェック
- **Amazon** (`amazon/`) - ウィッシュリストハイライト・アフィリエイトタグ自動追加
- **DMM** (`dmm/`) - 動画プレイヤーの新しいタブ表示
- **Universal** (`universal/`) - 汎用的な機能（要素ぼかし・キーバインド管理）
- **ニコニコ動画** (`niconico/`) - 漫画横読み変換・シリーズナビゲーション・キャンペーン自動処理
- **Twitter/X** (`twitter/`) - インテントコピー・ユーザーフィルター
- **YouTube** (`youtube/`) - 登録チャンネルレイアウト最適化
- **Mastodon** (`mastodon/`) - カラム管理・投稿編集・AI投稿ぼかし・UI改善
- **GitHub** (`github/`) - Gistページでの日付フィルタリング機能付きリンク一括開き

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
- **削除商品チェッカー**: 購入履歴から削除された商品があるページを検出し、前後の商品から特定を支援
- **価格・ポイントハイライター**: 条件達成時の視覚的通知とSlack・Mastodon連携
- **マンガ最初のページ開く**: Kindle Cloud Readerで最初のページを開く
- **Amazon Readerキーリマップ**: Amazon Kindle Readerでのカスタマイズ可能なキーボードショートカット（デフォルト：Z/X）

### Amazon (`amazon/`)

- **ウィッシュリストハイライト**: 特定条件のアイテムをハイライト表示
- **アフィリエイトタグ自動追加**: ペースト時にAmazonリンクにタグを自動追加

### DMM (`dmm/`)

- **動画タブオープナー**: DMM動画を新しいウィンドウではなく別タブで開く

### Universal (`universal/`)

- **要素ぼかし切り替え**: Option+Clickで任意の要素にモザイクをかける
- **マルチサイトキーバインド管理**: 複数サイト対応のキーバインドシステム（URL コピー、ページ開く、通知機能付き）

### ニコニコ動画 (`niconico/`)

- **縦読み→横読み変換**: ニコニコ漫画の縦読みを右から左の横読み形式に変換
- **シリーズナビゲーション**: シリーズ動画間のナビゲーションボタンとキーボードショートカット（Z/X/C）を追加
- **自動キャンペーンナビゲーター**: キャンペーンリンクを自動処理（遅延実行・クリックキャンセル機能付き）

### Twitter/X (`twitter/`)

- **ツイートインテント クリップボード**: X/Twitter インテントの内容をクリップボードにコピー（リンクを開かずに）
- **現在ユーザーフィルター**: 現在のユーザーのツイートのみを表示するフィルター機能（ボタンで切り替え可能）

### YouTube (`youtube/`)

- **登録チャンネル レイアウト最適化**: 登録チャンネルのレイアウト最適化（配信済み動画非表示・列数調整）

### Mastodon (`mastodon/`)

- **カラム分割**: 指定カラムを複数に分割してレイアウト改善
- **カラム結合**: 複数カラムを縦方向に結合
- **投稿編集ショートカット**: キーボードショートカットで投稿編集・リプライ
- **AI投稿ぼかし切り替え**: AI生成投稿のぼかし表示を切り替える機能

### GitHub (`github/`)

- **Gistリンクオープナー**: GitHub Gistページで日付フィルタリング機能付きのリンク一括開きボタンを表示

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