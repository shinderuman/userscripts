# DMM UserScripts

DMMサービスのユーザーエクスペリエンスを向上させるTampermonkeyスクリプト集です。

## 📋 スクリプト一覧

### 🎬 Video Tab Opener (`video_tab_opener/`)
DMM動画を新しいウィンドウではなく別タブで開くように変更するスクリプト。

**機能:**
- `javascript:void(0)`リンクを通常のリンクに変換
- `window.open`呼び出しからURLを抽出
- 新しいタブでの動画再生
- 自動的なリンク処理

**対象サイト:**
- `https://www.dmm.co.jp/digital/-/mylibrary/search/*`

**動作:**
1. ページ上の動画リンクを自動検出
2. `onclick`属性からURLを抽出
3. リンクを通常のhrefリンクに変換
4. クリック時に新しいタブで開く

## 🔧 共通ライブラリ (`common.js`)

DMM関連スクリプトで共有される汎用機能を提供します。

### 主要機能

#### DOM監視・操作
- `observeDOM(callback)`: DOM変更の監視
- `modifyLink(link, url)`: リンクの変更処理
- `extractUrlFromOnclick(onclick)`: onclick属性からURLを抽出
- `markAsProcessed(element)`: 処理済みマーク
- `isProcessed(element)`: 処理済み確認

```javascript
const { observeDOM, modifyLink, extractUrlFromOnclick } = unsafeWindow.DMMCommon;

// DOM変更を監視
observeDOM(() => {
    // 変更時の処理
});

// リンクを変更
const url = extractUrlFromOnclick(link.getAttribute('onclick'));
if (url) {
    modifyLink(link, url);
}
```

## 🚀 インストール方法

### 1. Tampermonkeyの準備
1. ブラウザにTampermonkey拡張機能をインストール
2. Tampermonkey Dashboardを開く

### 2. スクリプトのインストール
`video_tab_opener/wrapper.js`ファイルをTampermonkeyにインポート

### 3. パスの設定
`wrapper.js`ファイル内の`@require`パスを環境に合わせて調整:

```javascript
// @require file:///path/to/your/userscripts/dmm/common.js
// @require file:///path/to/your/userscripts/dmm/video_tab_opener/main.js
```

## ⚙️ 設定

### 対象サイト
- **DMM.co.jp**: デジタルライブラリの検索ページ
- 他のDMMページで使用する場合は`@match`を変更

### カスタマイズ
`main.js`内の`CONFIG`オブジェクトで設定を変更できます:

```javascript
const CONFIG = {
    LINK_SELECTOR: 'a[href^="javascript:void(0)"][onclick*="window.open"]'
};
```

## 🔍 使用方法

### 自動実行
スクリプトは自動的に初期化され、バックグラウンドで動作します。

### 手動実行（デバッグ用）
デベロッパーツールのコンソールで以下の関数を実行可能:

```javascript
// Video Tab Opener
initializePlayerOpenTab()
```

## 📊 ログ出力

スクリプトは詳細なログを出力します:
- 🚀 スクリプト読み込み状況
- 💡 初期化完了通知
- 🎬 動画リンク処理状況

## 🛠️ 開発・カスタマイズ

### アーキテクチャ
- **共通ライブラリ**: 再利用可能な機能を`common.js`に集約
- **スクリプト固有ロジック**: `main.js`に特化した処理を実装
- **Tampermonkey統合**: `wrapper.js`でUserScriptヘッダーを管理

### 新しいスクリプトの追加
1. 新しいディレクトリを作成
2. `main.js`でメインロジックを実装
3. `wrapper.js`でTampermonkeyヘッダーを設定
4. 共通ライブラリを活用

## 🚨 注意事項

- **DOM依存**: DMMのHTML構造変更に影響を受ける可能性
- **JavaScript実行**: `onclick`属性の解析に依存
- **ブラウザ互換性**: モダンブラウザでの動作を前提

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](../LICENSE)ファイルを参照してください。