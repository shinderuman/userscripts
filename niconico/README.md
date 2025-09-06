# ニコニコ動画 UserScripts

ニコニコ動画・ニコニコ漫画のユーザーエクスペリエンスを向上させるTampermonkeyスクリプト集です。

## 📋 スクリプト一覧

### 📖 Vertical to Horizontal Reader (`vertical_to_horizontal_reader/`)
ニコニコ漫画の縦読みを右から左の横読み形式に変換するスクリプト。

**機能:**
- 縦読み漫画を横読み形式に変換
- 見開きページの自動検出・処理
- キーボードナビゲーション（矢印キー）
- 前後エピソードへの自動遷移
- ESCキーによる処理中断

**対象サイト:**
- `https://manga.nicovideo.jp/watch/*`

**操作方法:**
- **→/↑**: 前のページ（右から左へ）
- **←/↓**: 次のページ
- **ESC**: 処理中断

**設定項目:**
```javascript
const CONFIG = {
    SELECTORS: {
        PAGE_CONTENTS: 'ul#page_contents > li',
        PREV_LINK: 'p.prev > a:not(.disabled)',
        NEXT_LINK: 'p.next > a:not(.disabled)'
    },
    STYLES: {
        CANVAS: {
            display: 'block',
            height: '100vh',
            width: 'auto',
            margin: '0 auto'
        }
    }
};
```

### 🎬 Video Series Navigation (`video_series_navigation/`)
シリーズ動画間のナビゲーションボタンとキーボードショートカットを追加するスクリプト。

**機能:**
- シリーズ動画の前後移動ボタン
- 最初のエピソードへのジャンプ
- 時間制御ボタン（±60秒）
- キーボードショートカット（Z/X/C）
- 自動的なボタン配置最適化

**対象サイト:**
- `https://www.nicovideo.jp/watch/*`

**キーボードショートカット:**
- **Zキー**: 10秒戻る
- **Xキー**: 一時停止/再生
- **Cキー**: 10秒送る

**ボタン配置:**
- **First**: シリーズ最初の動画
- **Previous**: 前の動画
- **Rewind(-60)**: 60秒戻る
- **[元の巻き戻しボタン]**
- **[元の早送りボタン]**
- **Forward(+60)**: 60秒送る
- **Next**: 次の動画

**設定項目:**
```javascript
const CONFIG = {
    TIME_OFFSETS: [-60, 60],  // 時間制御のオフセット（秒）
    KEY_BINDINGS: {
        'KeyZ': '#tooltip\\:«ra»\\:trigger',  // 10秒戻る
        'KeyX': '#tooltip\\:«r6»\\:trigger',  // 一時停止
        'KeyC': '#tooltip\\:«r9»\\:trigger'   // 10秒送る
    },
    SELECTORS: {
        PLAYER_CONTAINER: 'div.pos_relative.asp_auto.w_100\\%.ov_hidden.bdr_m',
        SERIES_SECTION: 'div.grid-area_\\[bottom\\].d_flex.flex-d_column.gap_x2'
    }
};
```

### 🎯 Auto Campaign Navigator (`auto_campaign_navigator/`)
ニコニコキャンペーンリンクを自動処理するスクリプト（遅延実行・クリックキャンセル機能付き）。

**機能:**
- キャンペーン画像の自動検出
- 単一リンクの遅延自動実行（1秒後）
- 複数リンクの新しいタブ一括オープン
- クリックによるキャンセル機能
- デバウンス処理による最適化

**対象サイト:**
- `https://koken.nicovideo.jp/campaign`

**動作:**
1. キャンペーン画像を自動検出
2. 1つの場合: 1秒後に自動遷移（クリックでキャンセル可能）
3. 複数の場合: 新しいタブで一括オープン

**設定項目:**
```javascript
const CONFIG = {
    CAMPAIGN_KEYWORDS: [
        '1日1回無料',
        '毎日無料',
        '無料の福引で',
        // ... その他のキーワード
    ],
    LINK_OPEN_DELAY_MS: 1000  // 遅延時間（ミリ秒）
};
```

## 🔧 共通ライブラリ (`common.js`)

ニコニコ関連スクリプトで共有される汎用機能を提供します。

### 主要機能

#### UI要素作成
- `createSVGButton(pathData)`: SVGボタンの作成
- `createCanvas(width, height)`: Canvas要素の作成
- `applyStyles(element, styles)`: スタイルの一括適用

#### DOM操作・監視
- `observeElement(element, callback)`: 要素の変更監視
- `scrollToElement(element)`: 要素へのスムーズスクロール
- `wait(ms)`: 指定時間の待機

#### 通知・UI
- `showNotification(title, message, duration)`: 通知表示
- `debounce(func, delay)`: デバウンス処理

#### 動画・URL処理
- `extractVideoId(element)`: 動画IDの抽出

```javascript
const { createSVGButton, showNotification, extractVideoId } = unsafeWindow.NiconicoCommon;

// SVGボタンを作成
const { button, svg } = createSVGButton('M12 4l-8 8 8 8V4');

// 通知を表示
showNotification('タイトル', 'メッセージ', 3000);

// 動画IDを抽出
const videoId = extractVideoId(linkElement);
```

## 🚀 インストール方法

### 1. Tampermonkeyの準備
1. ブラウザにTampermonkey拡張機能をインストール
2. Tampermonkey Dashboardを開く

### 2. スクリプトのインストール
各スクリプトの`wrapper.js`ファイルをTampermonkeyにインポート:

1. **Vertical to Horizontal Reader**: `vertical_to_horizontal_reader/wrapper.js`
2. **Video Series Navigation**: `video_series_navigation/wrapper.js`
3. **Auto Campaign Navigator**: `auto_campaign_navigator/wrapper.js`

### 3. パスの設定
`wrapper.js`ファイル内の`@require`パスを環境に合わせて調整:

```javascript
// @require file:///path/to/your/userscripts/niconico/common.js
// @require file:///path/to/your/userscripts/niconico/[script_name]/main.js
```

## ⚙️ 設定

### 対象サイト
- **ニコニコ動画**: `https://www.nicovideo.jp/watch/*`
- **ニコニコ漫画**: `https://manga.nicovideo.jp/watch/*`
- **ニコニコキャンペーン**: `https://koken.nicovideo.jp/campaign`

### 権限設定
一部スクリプトで以下の権限が必要:
- `GM_notification`: 通知表示

## 🔍 使用方法

### Vertical to Horizontal Reader
1. ニコニコ漫画のエピソードページを開く
2. 自動的に横読み形式に変換される
3. 矢印キーでページ移動
4. ESCキーで処理中断

### Video Series Navigation
1. ニコニコ動画のシリーズ動画を開く
2. プレイヤーに追加ボタンが表示される
3. ボタンクリックで前後の動画に移動
4. 時間制御ボタンで±60秒移動
5. Z/X/Cキーで動画操作（10秒戻る/一時停止/10秒送る）

### Auto Campaign Navigator
1. ニコニコキャンペーンページを開く
2. キャンペーンリンクが自動検出される
3. 1つの場合: 1秒後に自動遷移
4. 複数の場合: 新しいタブで一括オープン
5. クリックでキャンセル可能

### 手動実行（デバッグ用）
デベロッパーツールのコンソールで以下の関数を実行可能:

```javascript
// Vertical to Horizontal Reader
initializeMangaReader()

// Video Series Navigation
initializeSeriesVideoNavigator()

// Auto Campaign Navigator
initializeCampaignLinkHelper()
```

## 📊 ログ出力

各スクリプトは詳細なログを出力します:
- 🚀 スクリプト読み込み状況
- 💡 初期化完了通知
- 📖 漫画変換処理状況
- 🎬 動画ナビゲーション状況
- 🎯 キャンペーンリンク処理状況

## 🛠️ 開発・カスタマイズ

### アーキテクチャ
- **サービス特化**: ニコニコサービス専用の最適化
- **共通ライブラリ**: 再利用可能な機能を`common.js`に集約
- **レスポンシブ対応**: 動的なDOM変更に対応

### 新しいキャンペーンキーワードの追加
Auto Campaign Navigatorでは、新しいキャンペーンキーワードを追加可能:

```javascript
const CONFIG = {
    CAMPAIGN_KEYWORDS: [
        '1日1回無料',
        '新しいキャンペーン',  // 追加
        // ... その他
    ]
};
```

### カスタムSVGボタンの作成
Video Series Navigationでは、カスタムボタンを追加可能:

```javascript
const customButton = createSVGButton('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
```

## 🚨 注意事項

- **DOM依存**: ニコニコのHTML構造変更に影響を受ける可能性
- **Canvas操作**: 漫画変換でCanvas APIを使用
- **MutationObserver**: DOM監視によるパフォーマンス影響
- **自動実行**: キャンペーンナビゲーターの自動遷移に注意

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](../LICENSE)ファイルを参照してください。