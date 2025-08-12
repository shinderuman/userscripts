# Universal UserScripts

全てのWebサイトで使用可能な汎用Tampermonkeyスクリプト集です。

## 📋 スクリプト一覧

### 🎭 Element Blur Toggle (`element_blur_toggle/`)
Option+Clickで任意の要素にモザイク（ぼかし）をかけるスクリプト。

**機能:**
- Option/Alt + Click で要素をぼかし
- 再度クリックでぼかし解除
- 任意のWebサイトで動作
- リアルタイムでの視覚効果切り替え

**使用方法:**
1. Option/Alt キーを押しながら任意の要素をクリック
2. 要素にぼかし効果が適用される
3. 再度 Option/Alt + Click でぼかし解除

**設定項目:**
```javascript
const CONFIG = {
    BLUR_FILTER: 'blur(8px)',    // ぼかしの強度
    MODIFIER_KEY: 'altKey'       // 修飾キー（Option/Alt）
};
```

### ⌨️ Multi-Site Keybind Manager (`multi_site_keybind_manager/`)
複数サイト対応のキーバインド管理システム。URL コピー、ページ開く、通知機能付き。

**機能:**
- **Alt+↑**: ページ情報をクリップボードにコピー
- **Alt+↓**: AT-X番組表を新しいタブで開く
- **Alt+←**: ABEMAタイムテーブルを新しいタブで開く
- **Alt+→**: ニコニコキャンペーンページを開く（Amazonの場合は検索）
- **Cmd+T**: Vivaldiスタートページを開く
- Amazon商品情報の自動抽出・コピー
- Twitter/Xインテントボタンの自動クリック

**対象サイト:**
- 全てのWebサイト（`*://*/*`）
- Amazon商品ページでの特別機能
- Twitter/Xでのインテント処理

**設定項目:**
```javascript
const CONFIG = {
    SEARCH_ENGINE: 'https://www.google.com/search?q=',
    NAVIGATION_URLS: {
        ArrowLeft: 'https://abema.tv/timetable',
        ArrowDown: 'https://www.at-x.com/program',
        ArrowRight: 'https://koken.nicovideo.jp/campaign'
    },
    TAB_OPTIONS: {
        active: true,
        insert: true,
        setParent: true
    }
};
```

## 🔧 共通ライブラリ (`common.js`)

Universal関連スクリプトで共有される汎用機能を提供します。

### 主要機能

#### クリップボード操作
- `copyToClipboard(text)`: テキストをクリップボードにコピー
- `GM_setClipboard`を使用した確実なコピー

#### タブ・ウィンドウ操作
- `openInTab(url, options)`: 新しいタブでURLを開く
- `GM_openInTab`を使用した高度なタブ制御

#### 通知システム
- `showNotification(title, text, timeout)`: デスクトップ通知を表示
- `GM_notification`を使用したシステム通知

#### URL処理
- `cleanUrl(url)`: URLのクエリパラメータを除去
- `preventDefaultKeys(event, keys)`: 指定キーのデフォルト動作を防止

```javascript
const { copyToClipboard, openInTab, showNotification } = unsafeWindow.UniversalCommon;

// クリップボードにコピー
const success = await copyToClipboard('コピーするテキスト');

// 新しいタブで開く
openInTab('https://example.com', { active: true });

// 通知を表示
showNotification('タイトル', 'メッセージ', 3000);
```

## 🚀 インストール方法

### 1. Tampermonkeyの準備
1. ブラウザにTampermonkey拡張機能をインストール
2. Tampermonkey Dashboardを開く

### 2. スクリプトのインストール
各スクリプトの`wrapper.js`ファイルをTampermonkeyにインポート:

1. **Element Blur Toggle**: `element_blur_toggle/wrapper.js`
2. **Multi-Site Keybind Manager**: `multi_site_keybind_manager/wrapper.js`

### 3. パスの設定
`wrapper.js`ファイル内の`@require`パスを環境に合わせて調整:

```javascript
// @require file:///path/to/your/userscripts/universal/common.js
// @require file:///path/to/your/userscripts/universal/[script_name]/main.js
```

## ⚙️ 設定

### 対象サイト
- **全てのWebサイト**: `*://*/*`で全サイト対応
- サイト固有の機能は自動判定

### 権限設定
Multi-Site Keybind Managerは以下の権限が必要:
- `GM_setClipboard`: クリップボードアクセス
- `GM_openInTab`: タブ操作
- `GM_notification`: 通知表示

## 🔍 使用方法

### Element Blur Toggle
1. 任意のWebページを開く
2. Option/Alt キーを押しながら要素をクリック
3. 要素がぼかされる
4. 再度クリックでぼかし解除

### Multi-Site Keybind Manager
1. 任意のWebページで以下のキーを使用:
   - **Alt+↑**: ページ情報コピー
   - **Alt+↓**: AT-X番組表
   - **Alt+←**: ABEMAタイムテーブル
   - **Alt+→**: サイト別の特別機能
   - **Cmd+T**: Vivaldiスタートページ

### 手動実行（デバッグ用）
デベロッパーツールのコンソールで以下の関数を実行可能:

```javascript
// Element Blur Toggle
initializeBlurOnClick()

// Multi-Site Keybind Manager
initializeCustomKeybindHandler()
```

## 📊 ログ出力

各スクリプトは詳細なログを出力します:
- 🚀 スクリプト読み込み状況
- 💡 初期化完了通知
- ⌨️ キーボードショートカット情報
- 📋 クリップボード操作結果

## 🛠️ 開発・カスタマイズ

### アーキテクチャ
- **汎用設計**: 全サイト対応の柔軟な構造
- **共通ライブラリ**: 再利用可能な機能を`common.js`に集約
- **イベント駆動**: キーボード・マウスイベントベース

### キーバインドの追加
Multi-Site Keybind Managerでは、新しいキーバインドを簡単に追加可能:

```javascript
const handleKeyEvents = (event) => {
    if (!event.altKey) return;
    
    switch (event.key) {
        case 'KeyN': // Alt+N
            // 新しい機能を追加
            break;
    }
};
```

### サイト固有機能の追加
特定サイトでの動作をカスタマイズ:

```javascript
if (window.location.href.startsWith('https://example.com/')) {
    // example.com固有の処理
}
```

## 🚨 注意事項

- **全サイト実行**: 全てのWebサイトで動作するため、パフォーマンスに注意
- **キーバインド競合**: 既存のサイトのショートカットと競合する可能性
- **権限要求**: 一部機能でブラウザ権限が必要
- **セキュリティ**: クリップボードアクセスに注意

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](../LICENSE)ファイルを参照してください。