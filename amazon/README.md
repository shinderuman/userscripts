# Amazon UserScripts

Amazon関連サイトでのユーザーエクスペリエンスを向上させるTampermonkeyスクリプト集です。

## 📋 スクリプト一覧

### 🎯 Highlight (`highlight/`)
ウィッシュリストのアイテムを特定条件でハイライト表示するスクリプト。

**機能:**
- 設定可能な条件でアイテムをハイライト
- タイトル名と価格閾値による判定
- ナビゲーションバーの色変更
- ファビコンへのバッジ追加
- 最初のハイライトアイテムへの自動スクロール

**設定項目:**
```javascript
const CONFIG = {
    HIGHLIGHT_CONFIGS: [
        {
            title: 'てさぐれ',
            priceThreshold: 4000,
        },
        {
            title: '世話やき',
            priceThreshold: 5000,
        },
        {
            title: '魔法少女',
            priceThreshold: 10000,
        },
    ],
    BADGE_COLOR: '#900090'
};
```

### 🔗 Affiliate Tag Adder (`affiliate_tag_adder/`)
ペースト時にAmazonリンクへ自動的にアフィリエイトタグを追加するスクリプト。

**機能:**
- 全サイト対応（`*://*/*`）
- Amazonリンクの自動検出
- アフィリエイトパラメータの自動追加
- ハッシュタグ（フラグメント）の保持
- 入力フィールドでの選択範囲保持

**設定項目:**
```javascript
const CONFIG = {
    AFFILIATE_PARAMS: {
        tag: 'shinderuman03-22',
        linkCode: 'ogi',
        th: '1',
        psc: '1'
    }
};
```

## 🔧 共通ライブラリ (`common.js`)

全スクリプトで共有される汎用機能を提供します。

### 主要機能

#### DOM操作ユーティリティ
- `waitForElement(selector, timeout)`: 要素の出現を待機
- `observeElement(selector, callback)`: 要素の監視とコールバック実行
- `applyStyles(element, styleObj)`: スタイルオブジェクトの一括適用

#### 価格・URL操作
- `parsePrice(priceText)`: 価格テキストの数値変換
- `addUrlParams(url, params)`: URLパラメータの追加（ハッシュタグ保持）
- `isAmazonUrl(url)`: Amazon URLの判定

#### ページ操作
- `fetchPage(url)`: ページの取得とDOM解析
- `changeFavicon(url)`: ファビコンの変更
- `addBadgeToFavicon(color)`: ファビコンへのバッジ追加

```javascript
// 使用例
const { applyStyles, addUrlParams, isAmazonUrl } = unsafeWindow.AmazonCommon;

// スタイル適用
applyStyles(element, {
    backgroundColor: 'yellow',
    color: 'red',
    fontWeight: 'bold'
});

// URLパラメータ追加（ハッシュタグ保持）
const newUrl = addUrlParams('https://amazon.co.jp/dp/B123#section', {
    tag: 'affiliate-tag'
});
// → https://amazon.co.jp/dp/B123?tag=affiliate-tag#section
```

## 🚀 インストール方法

### 1. Tampermonkeyの準備
1. ブラウザにTampermonkey拡張機能をインストール
2. Tampermonkey Dashboardを開く

### 2. スクリプトのインストール
各スクリプトの`wrapper.js`ファイルをTampermonkeyにインポート:

1. **Highlight**: `highlight/wrapper.js`
2. **Affiliate Tag Adder**: `affiliate_tag_adder/wrapper.js`

### 3. パスの設定
`wrapper.js`ファイル内の`@require`パスを環境に合わせて調整:

```javascript
// @require file:///path/to/your/userscripts/amazon/common.js
// @require file:///path/to/your/userscripts/amazon/[script_name]/main.js
```

## ⚙️ 設定

### 対象サイト
- **Highlight**: 特定のウィッシュリスト（`https://www.amazon.co.jp/hz/wishlist/ls/1PCUI8FL5L6QU*`）
- **Affiliate Tag Adder**: 全サイト（`*://*/*`）

### カスタマイズ
各スクリプトの`main.js`内の`CONFIG`オブジェクトで設定を変更できます。

## 🔍 使用方法

### 自動実行
全てのスクリプトは自動的に初期化され、バックグラウンドで動作します。

### 手動実行（デバッグ用）
デベロッパーツールのコンソールで以下の関数を実行可能:

```javascript
// Highlight
initializeHighlight()

// Affiliate Tag Adder
initializeAffiliateTagAdder()
```

## 📊 ログ出力

各スクリプトは詳細なログを出力します:
- 🚀 スクリプト読み込み状況
- 💡 初期化完了通知
- 🎯 ハイライト実行状況
- 🔗 アフィリエイトタグ追加状況
- ❌ エラー情報

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

### ハイライト条件の追加
Highlightスクリプトでは、条件を簡単に追加できます:

```javascript
const CONFIG = {
    HIGHLIGHT_CONFIGS: [
        // 既存の条件...
        {
            title: '新しいタイトル',
            priceThreshold: 3000,
        }
    ]
};
```

## 🚨 注意事項

- **サイト依存**: AmazonのHTML構造変更に影響を受ける可能性
- **アフィリエイト**: アフィリエイトタグは適切な利用規約に従って使用
- **パフォーマンス**: 大量のアイテムがある場合は処理負荷に注意
- **プライバシー**: ペースト内容の処理は本人のブラウザ内でのみ実行

## 📝 更新履歴

最新の変更については、Gitコミット履歴を参照してください。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](../LICENSE)ファイルを参照してください。

## 🤝 貢献

改善提案やバグ報告は歓迎します。MITライセンスの下で自由に利用・改変できます。