# YouTube UserScripts

YouTubeのユーザーエクスペリエンスを向上させるTampermonkeyスクリプト集です。

## 📋 スクリプト一覧

### 📺 Subscription Layout Optimizer (`subscription_layout_optimizer/`)
登録チャンネルのレイアウト最適化（配信済み動画非表示・列数調整）を行うスクリプト。

**機能:**
- 配信済み動画の自動非表示
- グリッドレイアウトの列数調整（デフォルト5列）
- リアルタイムでのDOM変更監視
- 自動的なレイアウト最適化

**対象サイト:**
- `https://www.youtube.com/feed/subscriptions`
- `https://www.youtube.com`

**動作:**
1. 登録チャンネルページを開く
2. 配信済み動画を自動検出・非表示
3. グリッドレイアウトを指定列数に調整
4. DOM変更を監視して継続的に最適化

**設定項目:**
```javascript
const CONFIG = {
    COLUMN_COUNT: 5  // 表示する列数
};
```

**最適化内容:**
- **配信済み動画の非表示**: 「配信済み」「Streamed」テキストを含む動画を非表示
- **列数調整**: グリッドレイアウトを指定列数に変更
- **レスポンシブ対応**: ウィンドウサイズに応じた自動調整

## 🔧 共通ライブラリ (`common.js`)

YouTube関連スクリプトで共有される汎用機能を提供します。

### 主要機能

#### DOM監視・操作
- `observeDOM(callback)`: DOM変更の監視
- `setGridColumns(columnCount)`: グリッドレイアウトの列数設定
- `removePastStreams()`: 配信済み動画の削除

#### レイアウト制御
- CSS Grid プロパティの動的変更
- `grid-template-columns`の自動調整
- レスポンシブ対応

```javascript
const { observeDOM, setGridColumns, removePastStreams } = unsafeWindow.YouTubeCommon;

// DOM変更を監視
observeDOM(() => {
    // 変更時の処理
});

// グリッドを5列に設定
setGridColumns(5);

// 配信済み動画を削除
removePastStreams();
```

## 🚀 インストール方法

### 1. Tampermonkeyの準備
1. ブラウザにTampermonkey拡張機能をインストール
2. Tampermonkey Dashboardを開く

### 2. スクリプトのインストール
`subscription_layout_optimizer/wrapper.js`ファイルをTampermonkeyにインポート

### 3. パスの設定
`wrapper.js`ファイル内の`@require`パスを環境に合わせて調整:

```javascript
// @require file:///path/to/your/userscripts/youtube/common.js
// @require file:///path/to/your/userscripts/youtube/subscription_layout_optimizer/main.js
```

## ⚙️ 設定

### 対象サイト
- **YouTube登録チャンネル**: `https://www.youtube.com/feed/subscriptions`
- **YouTubeホーム**: `https://www.youtube.com`

### カスタマイズ
`main.js`内の`CONFIG`オブジェクトで設定を変更できます:

```javascript
const CONFIG = {
    COLUMN_COUNT: 5  // 表示したい列数（1-10推奨）
};
```

### 列数の推奨設定
- **3列**: 大きな動画サムネイル
- **4列**: バランスの良い表示
- **5列**: デフォルト（多くの動画を表示）
- **6列以上**: 小さなサムネイル（高解像度画面向け）

## 🔍 使用方法

### 自動実行
1. YouTube登録チャンネルページを開く
2. スクリプトが自動的に実行される
3. 配信済み動画が非表示になる
4. グリッドレイアウトが最適化される

### 手動実行（デバッグ用）
デベロッパーツールのコンソールで以下の関数を実行可能:

```javascript
// Subscription Layout Optimizer
initializeSubscriptionModifier()
```

### 効果の確認
- **Before**: 配信済み動画が混在、デフォルトレイアウト
- **After**: 配信済み動画が非表示、指定列数のグリッドレイアウト

## 📊 ログ出力

スクリプトは詳細なログを出力します:
- 🚀 スクリプト読み込み状況
- 💡 初期化完了通知
- 📺 列数設定情報
- 🗑️ 配信済み動画削除状況

## 🛠️ 開発・カスタマイズ

### アーキテクチャ
- **レイアウト特化**: YouTube UI専用の最適化
- **共通ライブラリ**: 再利用可能な機能を`common.js`に集約
- **リアルタイム対応**: 動的なコンテンツ読み込みに対応

### 新しいフィルタリング条件の追加
配信済み動画以外の条件でフィルタリング:

```javascript
const removePastStreams = () => {
    const videos = document.querySelectorAll('ytd-rich-item-renderer');
    videos.forEach(video => {
        const metadata = video.querySelector('#metadata-line');
        if (metadata && (
            metadata.textContent.includes('配信済み') ||
            metadata.textContent.includes('Streamed') ||
            metadata.textContent.includes('カスタム条件')  // 新しい条件
        )) {
            video.style.display = 'none';
        }
    });
};
```

### レスポンシブ対応の改善
画面サイズに応じた列数の自動調整:

```javascript
const getOptimalColumnCount = () => {
    const width = window.innerWidth;
    if (width < 1200) return 3;
    if (width < 1600) return 4;
    if (width < 2000) return 5;
    return 6;
};
```

### カスタムCSS の追加
追加のスタイリング:

```javascript
const applyCustomStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        ytd-rich-grid-renderer {
            --ytd-rich-grid-items-per-row: ${CONFIG.COLUMN_COUNT};
            gap: 16px !important;
        }
    `;
    document.head.appendChild(style);
};
```

## 🚨 注意事項

- **DOM依存**: YouTubeのHTML構造変更に影響を受ける可能性
- **パフォーマンス**: 大量の動画がある場合の処理負荷
- **レイアウト崩れ**: 極端な列数設定による表示問題
- **動的読み込み**: YouTubeの無限スクロールとの相性

## 📝 更新履歴

### Subscription Layout Optimizer
- グリッドレイアウト最適化機能
- 配信済み動画フィルタリング
- リアルタイムDOM監視
- レスポンシブ対応

## 🎯 今後の予定

- **チャンネル別フィルタリング**: 特定チャンネルの動画を非表示
- **時間ベースフィルタリング**: 古い動画の自動非表示
- **カテゴリ別表示**: ジャンル別のレイアウト調整
- **ダークモード対応**: テーマに応じたスタイル調整

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](../LICENSE)ファイルを参照してください。