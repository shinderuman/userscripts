---
inclusion: always
---

# UserScripts Project Rules

このファイルは、UserScriptsプロジェクト固有のルールを定義します。
**重要**: このルールに加えて、必ず `~/.kiro/steering/` の全てのファイルも参照・遵守してください。

## プロジェクト構造ルール

### ディレクトリ構成
```
userscripts/
├── [service]/                  # サービス別ディレクトリ
│   ├── README.md              # サービス固有の詳細ドキュメント
│   ├── common.js              # サービス内共通ライブラリ
│   └── [feature]/             # 機能別ディレクトリ
│       ├── main.js            # メインロジック
│       └── wrapper.js         # Tampermonkeyヘッダー
├── README.md                  # プロジェクト全体概要
└── LICENSE                    # MITライセンス
```

### 必須ファイル構成
- **main.js**: スクリプトのメインロジック（UserScriptヘッダーなし）
- **wrapper.js**: Tampermonkey用UserScriptヘッダーと@requireディレクティブ
- **common.js**: サービス内で共有される汎用機能
- **README.md**: 各レベルでの詳細ドキュメント

## コーディング規約

### 共通ライブラリ設計
- **サービス別分離**: 各サービスは独自の`common.js`を持つ
- **unsafeWindow使用**: `unsafeWindow.[ServiceName]Common`として公開
- **関数の粒度**: 真に再利用可能な機能のみを共通化
- **特化ロジック**: サービス固有の処理は各`main.js`に配置

### 関数配置ルール
- ~/.kiro/steering/coding-standards.mdの関数配置ルールに従う

### UserScript構成
```javascript
// wrapper.js
// ==UserScript==
// @name         [Script Name] Wrapper
// @require      file:///path/to/common.js
// @require      file:///path/to/main.js
// @grant        unsafeWindow
// ==/UserScript==

// main.js
(function () {
    'use strict';
    
    // 共通ライブラリから関数を取得
    const { func1, func2 } = unsafeWindow.[ServiceName]Common;
    
    // メインロジック
    
    // グローバル関数として公開
    unsafeWindow.initializeFeature = initializeFeature;
})();
```

## サービス追加ルール

### 新しいサービスの追加手順
1. **ディレクトリ作成**: `[service]/`ディレクトリを作成
2. **共通ライブラリ**: `[service]/common.js`でサービス固有の共通機能を実装
3. **機能実装**: 各機能毎に`[feature]/main.js`と`wrapper.js`を作成
4. **ドキュメント**: `[service]/README.md`で詳細を説明
5. **ルートREADME更新**: プロジェクト構造と対応サービス一覧を更新

### 共通ライブラリ命名規則
- **Kindle**: `unsafeWindow.KindleCommon`
- **Mastodon**: `unsafeWindow.MastodonCommon`
- **新サービス**: `unsafeWindow.[ServiceName]Common`

## ドキュメント規約

### README.md構成
#### ルートREADME
- プロジェクト全体概要
- 対応サービス一覧
- 基本的な使用方法
- 開発アーキテクチャ

#### サービスREADME
- スクリプト一覧と詳細機能
- 共通ライブラリAPI仕様
- インストール・設定方法
- 使用方法とログ出力
- 開発・カスタマイズガイド

### ドキュメント更新ルール
- 新機能追加時は必ずREADMEを更新
- API変更時は共通ライブラリの説明を更新
- 設定項目変更時は設定セクションを更新

## Git運用ルール
- ~/.kiro/steering/git-commands.mdの全ルールに従う
- このプロジェクト特有の追加要件はなし

## 品質保証ルール

### UserScript固有のテスト要件
- 各スクリプトは対象サイトで動作確認
- 共通ライブラリの変更は全依存スクリプトで確認
- Tampermonkey環境での動作確認

### UserScript固有のパフォーマンス考慮
- MutationObserverの適切な使用
- DOM操作の最適化
- IndexedDBキャッシュの活用

### UserScript固有のセキュリティ考慮
- 外部APIアクセスの安全性確認
- @grantディレクティブの最小権限原則
- XSS対策の実装

## 禁止事項

### 構造違反
- ❌ UserScriptヘッダーを`main.js`に含める
- ❌ サービス固有ロジックを他サービスの`common.js`に配置
- その他の違反は ~/.kiro/steering/ の各ルールを参照

### コーディング違反
- ~/.kiro/steering/coding-standards.mdの禁止事項に加えて：
- ❌ ハードコードされた設定値

## 参照必須ファイル

このプロジェクトルールに加えて、以下のファイルを**必ず参照・遵守**してください：

### ~/.kiro/steering/ の全ファイル
- **coding-standards.md**: 一般的なコーディング規約、関数配置ルール
- **git-commands.md**: Git運用ルール、コミットメッセージ規約
- その他の全てのステアリングファイル

これらのルールは**このプロジェクトルールより優先**されます。競合する場合は`~/.kiro/steering/`のルールに従ってください。