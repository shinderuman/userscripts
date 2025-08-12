# Twitter/X UserScripts

Twitter/X（旧Twitter）のユーザーエクスペリエンスを向上させるTampermonkeyスクリプト集です。

## 📋 スクリプト一覧

### 📋 Tweet Intent Clipboard (`tweet_intent_clipboard/`)
X/Twitter インテントの内容をクリップボードにコピーするスクリプト（リンクを開かずに）。

**機能:**
- インテントリンクのクリック時にコピー実行
- `window.open`のオーバーライドでインテント処理
- テキスト・URL・ハッシュタグの自動抽出
- エラー通知機能（URL不足時）
- トースト通知でコピー結果表示

**対象サイト:**
- 全てのWebサイト（`*://*/*`）
- Twitter/Xインテントリンクを含むページ

**対応インテントパターン:**
- `twitter.com/intent/tweet`
- `twitter.com/share`
- `x.com/intent/post`
- `x.com/intent/tweet`
- `x.com/share`

**動作:**
1. インテントリンクをクリック
2. URLパラメータを自動解析
3. テキスト・URL・ハッシュタグを抽出
4. クリップボードにコピー
5. トースト通知で結果表示

### 👤 Current User Filter (`current_user_filter/`)
現在のユーザーのツイートのみを表示するフィルター機能（ボタンで切り替え可能）。

**機能:**
- 現在のユーザーのツイートのみ表示
- 他のユーザーのツイートを非表示
- ワンクリックでフィルター切り替え
- リアルタイムでの表示制御
- DOM変更の自動監視

**対象サイト:**
- `https://x.com/*`

**使用方法:**
1. X（Twitter）を開く
2. 「このアカウントのみ表示」ボタンをクリック
3. 現在のユーザーのツイートのみが表示される
4. 「すべて表示」ボタンで元に戻す

**設定項目:**
```javascript
// 設定は自動的に現在のユーザーを検出
// 手動設定は不要
```

## 🔧 共通ライブラリ (`common.js`)

Twitter/X関連スクリプトで共有される汎用機能を提供します。

### 主要機能

#### インテント処理
- `INTENT_PATTERNS`: サポートするインテントパターン
- `isIntentUrl(url)`: インテントURLの判定
- `extractIntentParams(url)`: インテントパラメータの抽出

#### UI操作
- `showToast(title, message, url, bgColor, borderColor)`: トースト通知表示
- `createButton(text)`: ボタン要素の作成
- `getCurrentUser()`: 現在のユーザー名取得

#### クリップボード操作
- `copyToClipboard(text)`: テキストのクリップボードコピー

```javascript
const { isIntentUrl, extractIntentParams, showToast, getCurrentUser } = unsafeWindow.TwitterCommon;

// インテントURLの判定
if (isIntentUrl(url)) {
    const { text, url: intentUrl, hashtags } = extractIntentParams(url);
    // パラメータを使用
}

// 現在のユーザーを取得
const currentUser = getCurrentUser();

// トースト通知を表示
showToast('タイトル', 'メッセージ', 'https://example.com');
```

## 🚀 インストール方法

### 1. Tampermonkeyの準備
1. ブラウザにTampermonkey拡張機能をインストール
2. Tampermonkey Dashboardを開く

### 2. スクリプトのインストール
各スクリプトの`wrapper.js`ファイルをTampermonkeyにインポート:

1. **Tweet Intent Clipboard**: `tweet_intent_clipboard/wrapper.js`
2. **Current User Filter**: `current_user_filter/wrapper.js`

### 3. パスの設定
`wrapper.js`ファイル内の`@require`パスを環境に合わせて調整:

```javascript
// @require file:///path/to/your/userscripts/twitter/common.js
// @require file:///path/to/your/userscripts/twitter/[script_name]/main.js
```

## ⚙️ 設定

### 対象サイト
- **Tweet Intent Clipboard**: 全てのWebサイト（`*://*/*`）
- **Current User Filter**: X（Twitter）専用（`https://x.com/*`）

### 自動設定
- Current User Filterは現在のユーザーを自動検出
- 手動設定は不要

## 🔍 使用方法

### Tweet Intent Clipboard
1. インテントリンクを含むWebページを開く
2. インテントリンクをクリック
3. 自動的にクリップボードにコピーされる
4. トースト通知で結果確認

### Current User Filter
1. X（Twitter）を開く
2. 画面に表示される「このアカウントのみ表示」ボタンをクリック
3. 現在のユーザーのツイートのみが表示される
4. 「すべて表示」ボタンで元の表示に戻す

### 手動実行（デバッグ用）
デベロッパーツールのコンソールで以下の関数を実行可能:

```javascript
// Tweet Intent Clipboard
initializeIntentCopier()

// Current User Filter
initializeShowYourself()
```

## 📊 ログ出力

各スクリプトは詳細なログを出力します:
- 🚀 スクリプト読み込み状況
- 💡 初期化完了通知
- 📋 インテントコピー結果
- 👤 フィルター切り替え状況

## 🛠️ 開発・カスタマイズ

### アーキテクチャ
- **イベント駆動**: クリック・DOM変更イベントベース
- **共通ライブラリ**: 再利用可能な機能を`common.js`に集約
- **非侵入的**: 既存のTwitter/X機能を妨げない設計

### 新しいインテントパターンの追加
Tweet Intent Clipboardでは、新しいインテントパターンを追加可能:

```javascript
const INTENT_PATTERNS = [
    'twitter.com/intent/tweet',
    'x.com/intent/post',
    'new-platform.com/intent/share',  // 新しいパターン
];
```

### カスタムフィルタリングルールの追加
Current User Filterでは、フィルタリングロジックをカスタマイズ可能:

```javascript
const showOnlyCurrentUserTweets = () => {
    Array.from(document.querySelectorAll('article'))
        .filter(tweet => {
            // カスタムフィルタリング条件
            return !isCurrentUserTweet(tweet);
        })
        .forEach(tweet => {
            tweet.style.display = 'none';
        });
};
```

### トースト通知のカスタマイズ
通知の外観をカスタマイズ:

```javascript
showToast('タイトル', 'メッセージ', 'https://example.com', '#custom-bg', '#custom-border');
```

## 🚨 注意事項

- **DOM依存**: Twitter/XのHTML構造変更に影響を受ける可能性
- **API変更**: Twitter/Xの仕様変更に注意
- **プライバシー**: クリップボードアクセスに注意
- **パフォーマンス**: リアルタイムフィルタリングの処理負荷

## 📝 更新履歴

### Tweet Intent Clipboard
- インテントパラメータの抽出機能
- エラーハンドリングの改善
- トースト通知の追加

### Current User Filter
- 自動ユーザー検出機能
- リアルタイムフィルタリング
- ボタンUIの改善

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](../LICENSE)ファイルを参照してください。