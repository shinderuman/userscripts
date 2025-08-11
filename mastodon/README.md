# Mastodon UserScripts

Mastodonのユーザーエクスペリエンスを向上させるTampermonkeyスクリプト集です。

## 📋 スクリプト一覧

### 🔀 Column Splitter (`column_splitter/`)
指定したカラムを複数に分割・複製してレイアウト管理を改善するスクリプト。

**機能:**
- 指定カラムを設定可能な数に分割
- 各分割カラムに投稿を振り分け
- アカウント別のコンテンツフィルタリング
- OurtAI画像の自動取得・表示
- IndexedDBを使用した画像キャッシュ
- タブ非アクティブ時の遅延実行対応

**設定項目:**
```javascript
const CONFIG = {
    TARGET_COLUMN_LABEL: '#StabilityAI',    // 分割対象カラム
    INSERT_BEFORE_LABEL: 'ホーム',          // 挿入位置の基準カラム
    COLUMN_SPLIT_COUNT: 3,                  // 分割数
    EXPIRATION_TIME: 24 * 60 * 60 * 1000 * 7 // キャッシュ期限（7日）
};
```

### 🔗 Column Combiner (`column_combiner/`)
指定した複数のカラムを縦に結合して単一セクションにまとめるスクリプト。

**機能:**
- 複数のカラムペアを縦方向に結合
- フレキシブルなレイアウト調整
- カラム幅の自動調整

**設定項目:**
```javascript
const COLUMN_PAIRS = [
    {
        topColumnName: '投稿の新規作成',
        bottomColumnName: '通知',
    },
    {
        topColumnName: '#gochisou_photo',
        bottomColumnName: '#文鳥',
    }
];
```

### ⌨️ Recent Post Editor (`recent_post_editor/`)
キーボードショートカットで最新の投稿を編集・リプライするスクリプト。

**機能:**
- **Command+↑**: 最新の自分の投稿を編集
- **Command+Shift+↑**: 最新の自分の投稿にリプライ
- テキストエリアが空の時のみ動作
- 自動的なドロップダウンメニュー操作

**設定項目:**
```javascript
const CONFIG = {
    USERNAME: 'asmodeus',  // 対象ユーザー名
    HOME_COLUMN_SELECTOR: 'div[aria-label="ホーム"]',
    COMPOSE_TEXTAREA_SELECTOR: 'form > div.compose-form__highlightable > div.compose-form__scrollable > div > textarea'
};
```

## 🔧 共通ライブラリ (`common.js`)

全スクリプトで共有される汎用機能を提供します。

### 主要機能

#### ImageCache クラス
- **IndexedDB**: ブラウザ内データベースを使用した永続化
- **自動期限切れ**: 設定期間後の自動データ削除
- **Blob対応**: 画像データの効率的な保存・取得

```javascript
const imageCache = new ImageCache();
const cachedData = await imageCache.getCachedData(id);
await imageCache.saveToIndexedDB(id, data);
```

#### DeferredMutationObserver クラス
- **タブ状態監視**: アクティブ/非アクティブの自動検出
- **遅延実行**: 非アクティブ時の変更を蓄積し、アクティブ時に一括処理
- **パフォーマンス最適化**: 不要な処理を削減

```javascript
const observer = new DeferredMutationObserver(callback);
observer.observe(target, options);
```

#### DOM操作ユーティリティ
- `waitForElement(selector, timeout)`: 要素の出現を待機
- `waitForElements(selectors, timeout)`: 複数要素の出現を待機
- `getCurrentUsername()`: 現在のユーザー名を取得

#### API通信
- `fetchAPI(url, options)`: 共通APIリクエスト関数
- エラーハンドリング統一
- JSON自動パース

## 🚀 インストール方法

### 1. Tampermonkeyの準備
1. ブラウザにTampermonkey拡張機能をインストール
2. Tampermonkey Dashboardを開く

### 2. スクリプトのインストール
各スクリプトの`wrapper.js`ファイルをTampermonkeyにインポート:

1. **Column Splitter**: `column_splitter/wrapper.js`
2. **Column Combiner**: `column_combiner/wrapper.js`
3. **Recent Post Editor**: `recent_post_editor/wrapper.js`

### 3. パスの設定
`wrapper.js`ファイル内の`@require`パスを環境に合わせて調整:

```javascript
// @require file:///path/to/your/userscripts/mastodon/common.js
// @require file:///path/to/your/userscripts/mastodon/[script_name]/main.js
```

## ⚙️ 設定

### 対象サイト
- **kenji.asmodeus.jp**: 専用Mastodonインスタンス
- 他のインスタンスで使用する場合は`@match`を変更

### カスタマイズ
各スクリプトの`main.js`内の`CONFIG`オブジェクトで設定を変更できます。

## 🔍 使用方法

### 自動実行
全てのスクリプトは自動的に初期化され、バックグラウンドで動作します。

### 手動実行（デバッグ用）
デベロッパーツールのコンソールで以下の関数を実行可能:

```javascript
// Column Splitter
initializeColumnSplitter()

// Column Combiner  
initializeColumnCombiner()

// Recent Post Editor
initializeRecentPostEditor()
```

## 📊 ログ出力

各スクリプトは詳細なログを出力します:
- 🚀 スクリプト読み込み状況
- 💡 初期化完了通知
- ⌨️ キーボードショートカット情報
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

### フィルタリングルールの追加
Column Splitterでは、アカウント別のコンテンツフィルタリングが可能:

```javascript
const rules = [{
    'removeContent': {
        'accounts': ['@example@instance.com'],
        'func': (article) => {
            // コンテンツ削除処理
        }
    }
}];
```

## 🚨 注意事項

- **インスタンス固有**: 現在は`kenji.asmodeus.jp`専用
- **DOM依存**: MastodonのHTML構造変更に影響を受ける可能性
- **パフォーマンス**: 大量の投稿がある場合は処理負荷に注意
- **キャッシュ管理**: IndexedDBの容量制限に注意

## 📝 更新履歴

最新の変更については、Gitコミット履歴を参照してください。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](../LICENSE)ファイルを参照してください。

## 🤝 貢献

改善提案やバグ報告は歓迎します。MITライセンスの下で自由に利用・改変できます。