# Kindle UserScripts

Amazon Kindleストアでの書籍チェックを自動化するTampermonkeyスクリプト集です。

## 📋 スクリプト一覧

### 🆕 New Release Checker (`new_release_checker/`)
指定した作者の新刊をチェックして通知するスクリプト。

**機能:**
- S3から作者リストを取得
- Amazon検索結果から新刊を自動検出
- 発売日ベースの新刊判定（デフォルト7日以内）
- 除外キーワードによるフィルタリング
- 重複通知の防止

**使用方法:**
```javascript
// デベロッパーツールで実行
checkNewReleases()
```

### 📖 Paper to Kindle Checker (`paper_to_kindle_checker/`)
紙書籍とKindle版の両方が利用可能な商品を発見するスクリプト。

**機能:**
- S3から書籍ASINリストを取得
- 各商品ページで紙書籍・Kindle版の利用可能性をチェック
- 両方利用可能な商品を通知

**使用方法:**
```javascript
// デベロッパーツールで実行
checkPaperToKindle()
```

### 💰 Sale Checker (`sale_checker/`)
ウィッシュリストの書籍のセール情報をチェックするスクリプト。

**機能:**
- S3から書籍ASINリストを取得
- 価格・ポイント情報を取得
- セール条件の判定（価格閾値、ポイント率など）
- セール発見時の通知

**使用方法:**
```javascript
// デベロッパーツールで実行
checkWishlistSales()
```

### 📘 Campaign Sorter (`campaign_sorter/`)
期間限定キャンペーン対象のKindle本を抽出し価格順に表示するスクリプト。

**機能:**
- キャンペーン対象商品の自動検出

### 💎 Price and Point Highlighter (`price_and_point_highlighter/`)
Kindle書籍の価格とポイント条件を満たす場合、視覚的に通知するスクリプト。

**機能:**
- 価格・ポイント条件の自動判定
- ナビゲーションバーのハイライト表示
- ファビコンへのバッジ追加
- Slack・Mastodon連携通知
- 通知クリック・ナビバークリック時の両プラットフォーム同時投稿
- 外部設定ファイル対応（config.js）

**設定:**
`config.js`ファイルを作成してSlack・Mastodonの認証情報を設定:
```javascript
// 共通設定ファイル
unsafeWindow.GlobalConfig = {
    // コメントアウトしている場合は通知しない
    // slack: {
    //     token: "xoxb-your-slack-bot-token",
    //     channelId: "C0123456789"
    // },
    mastodon: {
        accessToken: "your-mastodon-access-token",
        apiEndpoint: "https://your-instance.com/api/v1/statuses"
    }
};
```
- 複数ページの一括処理（最大20ページ）
- 価格順ソート表示
- 手動ボタントリガー
- 結果の表示・非表示切り替え



### 🗑️ Deleted Item Checker (`deleted_item_checker/`)
購入履歴から削除された商品があるページを検出するスクリプト。

**機能:**
- 購入履歴ページを指定範囲で自動スキャン（デフォルト：0〜100ページ）
- 「本商品は現在カタログにありません。」メッセージの検出
- 削除商品が含まれるページのURL一覧表示
- 削除商品の前後の商品名を抽出し、Amazon注文履歴検索リンクを生成
- 複数削除商品がある場合の個別検出
- 前の削除ページとの差分ページ数表示
- 開始ページ・終了ページの画面上設定
- 手動ボタントリガー
- 結果の表示・非表示切り替え

**使用方法:**
1. https://www.amazon.co.jp/gp/yourstore/iyr/?ie=UTF8&ref_=sv_ys_3 にアクセス
2. 必要に応じて開始ページ・終了ページを設定（デフォルト：0〜100）
3. 「🗑️ 削除商品をチェック」ボタンをクリック
4. 結果の商品名リンクをクリックしてAmazon注文履歴で検索
5. 前後の商品から削除された商品を特定

### 📚 本棚巻数フィルター (`library_volume_filter/`)
Kindle本棚（シリーズビュー）で巻数による絞り込み機能を提供するスクリプト。

**機能:**
- **最小/最大モード切り替え**: 指定巻数以上または以下のシリーズを表示
- **トップバー統合**: 既存の検索・フィルター・並べ替えボタンと統合されたUI
- **リアルタイムフィルタリング**: 入力と同時にフィルタリング実行
- **動的コンテンツ対応**: 無限スクロールで読み込まれる新コンテンツにも自動適用
- **リセット機能**: ワンクリックでフィルターをクリア

**対応サイト:**
- `https://read.amazon.co.jp/kindle-library?tabView=series*` - Kindle本棚シリーズビュー

**使用方法:**
1. Kindle本棚のシリーズビューを開く
2. トップバーの「最小:」ボタンをクリックして「最大:」に切り替え可能
3. 数値入力フィールドに巻数を入力
4. 指定条件に合うシリーズのみが表示される
5. ×ボタンでフィルターをリセット

**フィルタリング例:**
- **最小モード「10」**: 10巻以上のシリーズのみ表示（長期連載作品の絞り込み）
- **最大モード「5」**: 5巻以下のシリーズのみ表示（短編・完結作品の絞り込み）
- **空欄**: 全シリーズを表示

### ⌨️ Amazon Kindle Reader統合スクリプト (`reader_key_remap/`)
Amazon Kindle Readerでの包括的なキーボードショートカット機能を提供する統合スクリプト。

**統合機能:**
- **ページナビゲーション**: カスタマイズ可能なキーバインドでページ送り
- **次の巻を開く**: 続巻がある場合の自動巻切り替え
- **最初のページ移動**: ワンキーで最初のページにジャンプ
- **URL変更監視**: ページ遷移時の自動再初期化

**対応サイト:**
- `https://read.amazon.co.jp/manga/*` - Kindleマンガリーダー

**キーボードショートカット:**
- **Zキー**: 前のページ
- **Xキー**: 次のページ  
- **Aキー**: 次の巻を開く（続巻がある場合）
- **0キー**: 最初のページに移動

**次の巻を開く機能:**
Aキーを押すと以下の処理が自動実行されます：
1. 「さらに読む」ボタンをクリック
2. 「今すぐ読む」ボタンが出現するまで監視
3. 出現後に自動クリックして次の巻を開く

**最初のページ移動機能:**
0キーを押すと以下の処理が自動実行されます：
1. メニューボタンをクリック
2. 最初のページボタンが出現するまで監視
3. 出現後に自動クリックして最初のページに移動

**カスタマイズ:**
`main.js`の`KEY_BINDINGS`オブジェクトでキーを変更可能：

```javascript
const KEY_BINDINGS = {
    PREV_PAGE: 'KeyZ',      // 前のページ（デフォルト：Z）
    NEXT_PAGE: 'KeyX',      // 次のページ（デフォルト：X）
    NEXT_VOLUME: 'KeyA',    // 次の巻（デフォルト：A）
    FIRST_PAGE: 'Digit0'    // 最初のページ（デフォルト：0）
};
```

例：異なるキーに変更する場合
```javascript
const KEY_BINDINGS = {
    PREV_PAGE: 'KeyQ',      // Qキー → 前のページ
    NEXT_PAGE: 'KeyW',      // Wキー → 次のページ
    NEXT_VOLUME: 'KeyE',    // Eキー → 次の巻
    FIRST_PAGE: 'Digit9'    // 9キー → 最初のページ
};
```

## 🔧 共通ライブラリ (`common.js`)

全スクリプトで共有される汎用機能を提供します。

### 主要機能

#### データ取得
- `fetchJsonFromS3(url, dataType)`: S3からJSONデータを取得
- `fetchPageInfo(url, extractorFunction)`: 個別ページ情報を取得

#### 通知システム
- `sendNotification(title, text, url, timeout)`: 基本通知
- `sendCompletionNotification(scriptName, totalCount, resultCount)`: 完了通知
- `sendErrorNotification(scriptName, errorMessage)`: エラー通知

#### バッチ処理
- `processBatch(items, processorFunction, config)`: 並行処理制御

#### ストレージ管理
- `getStorageItems(storageKey)`: localStorage読み込み
- `saveStorageItem(storageKey, item)`: localStorage保存
- `isAlreadyStored(storageKey, checkFunction)`: 重複チェック
- `cleanupOldStorageItems(storageKey, cutoffDate)`: 古いデータ削除

#### ユーティリティ
- `extractAsinFromUrl(url)`: URLからASIN抽出
- `getElementValue(doc, selector, regex)`: DOM要素値取得

## 🚀 インストール方法

### 1. Tampermonkeyの準備
1. ブラウザにTampermonkey拡張機能をインストール
2. Tampermonkey Dashboardを開く

### 2. スクリプトのインストール
各スクリプトの`wrapper.js`ファイルをTampermonkeyにインポート:

1. **New Release Checker**: `new_release_checker/wrapper.js`
2. **Paper to Kindle Checker**: `paper_to_kindle_checker/wrapper.js`
3. **Sale Checker**: `sale_checker/wrapper.js`
4. **Deleted Item Checker**: `deleted_item_checker/wrapper.js`
5. **本棚巻数フィルター**: `library_volume_filter/wrapper.js`
6. **Amazon Kindle Reader統合スクリプト**: `reader_key_remap/wrapper.js`

### 3. パスの設定
`wrapper.js`ファイル内の`@require`パスを環境に合わせて調整:

```javascript
// @require file:///path/to/your/userscripts/kindle/common.js
// @require file:///path/to/your/userscripts/kindle/[script_name]/main.js
```

## ⚙️ 設定

### 設定項目
各スクリプトの`main.js`内の`CONFIG`オブジェクトで設定を変更できます:

```javascript
const CONFIG = {
    CONCURRENT_REQUESTS: 20,    // 同時リクエスト数
    REQUEST_DELAY: 1000,        // リクエスト間隔（ミリ秒）
    NEW_RELEASE_DAYS: 7,        // 新刊判定日数
    MIN_PRICE: 221,             // 最低価格（円）
    THRESHOLD: 151              // セール判定閾値
};
```

### データソース
スクリプトはS3から以下のJSONファイルを取得します:
- `authors.json`: 作者リスト
- `excluded_title_keywords.json`: 除外キーワード
- `paper_books_asins.json`: 紙書籍ASINリスト
- `unprocessed_asins.json`: 未処理ASINリスト

## 🔍 使用方法

### 基本的な流れ
1. Amazon.co.jpにアクセス
2. デベロッパーツール（F12）を開く
3. コンソールで対応する関数を実行

### 実行例
```javascript
// 新刊チェック
checkNewReleases()

// 紙書籍→Kindle版チェック
checkPaperToKindle()

// セールチェック
checkWishlistSales()
```

## 📊 ログ出力

各スクリプトは詳細なログを出力します:
- 📥 データ取得状況
- 📚 処理進捗
- ✅ 成功通知
- ❌ エラー情報
- 🧹 クリーンアップ状況

## 🛠️ 開発・カスタマイズ

### アーキテクチャ
- **共通ライブラリ**: 再利用可能な機能を`common.js`に集約
- **スクリプト固有ロジック**: 各`main.js`に特化した処理を実装
- **Tampermonkey統合**: `wrapper.js`でUserScriptヘッダーを管理

### 新しいスクリプトの追加
1. 新しいディレクトリを作成
2. `main.js`でメインロジックを実装
3. `wrapper.js`でTampermonkeyヘッダーを設定
4. 共通ライブラリを活用

## 🚨 注意事項

- **レート制限**: Amazon APIの制限を考慮した並行処理制御
- **エラーハンドリング**: ネットワークエラーや解析エラーに対応
- **データ保護**: 個人情報を含まないよう注意
- **利用規約**: Amazonの利用規約を遵守

## 📝 更新履歴

最新の変更については、Gitコミット履歴を参照してください。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](../LICENSE)ファイルを参照してください。

## 🤝 貢献

改善提案やバグ報告は歓迎します。MITライセンスの下で自由に利用・改変できます。