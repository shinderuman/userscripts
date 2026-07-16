(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const { COMMON_SELECTORS, COMMON_ENDPOINTS } = unsafeWindow.MastodonCommon;

    let isShiftCommandPressed = false;

    const CONFIG = {
        API_ENDPOINT: COMMON_ENDPOINTS.STATUSES,
        TEXTAREA_SELECTOR: COMMON_SELECTORS.TEXTAREA
    };

    // オリジナルのfetchとXMLHttpRequestを保存
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    // fetchをフック
    window.fetch = function (url, options) {
        if (
            url === CONFIG.API_ENDPOINT &&
            options &&
            options.method === 'POST' &&
            isShiftCommandPressed
        ) {
            try {
                const payload = JSON.parse(options.body);
                payload.visibility = 'private';
                payload.quote_approval_policy = 'nobody';
                options.body = JSON.stringify(payload);
                isShiftCommandPressed = false;
            } catch (error) {
                console.error('❌ payload書き換えエラー:', error);
            }
        }

        return originalFetch.apply(this, arguments);
    };

    // XMLHttpRequestをフック
    XMLHttpRequest.prototype.open = function (method, url) {
        this._method = method;
        this._url = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (data) {
        if (
            this._url === CONFIG.API_ENDPOINT &&
            this._method === 'POST' &&
            isShiftCommandPressed &&
            data
        ) {
            try {
                const payload = JSON.parse(data);
                payload.visibility = 'private';
                payload.quote_approval_policy = 'nobody';
                data = JSON.stringify(payload);
                isShiftCommandPressed = false;
            } catch (error) {
                console.error('❌ payload書き換えエラー (XHR):', error);
            }
        }

        return originalXHRSend.call(this, data);
    };

    // キーボードイベントを監視
    const handleKeyDown = (event) => {
        if (event.metaKey && event.shiftKey && event.key === 'Enter') {
            isShiftCommandPressed = true;
        }
    };

    // キーイベントをキャプチャフェーズで監視（より早い段階で検出）
    const handleKeyDownCapture = (event) => {
        if (event.metaKey && event.shiftKey && event.key === 'Enter') {
            isShiftCommandPressed = true;
        }
    };

    const initializeVisibilityModifier = () => {
        // キャプチャフェーズとバブリングフェーズの両方で監視
        document.addEventListener('keydown', handleKeyDownCapture, true); // キャプチャフェーズ
        document.addEventListener('keydown', handleKeyDown, false); // バブリングフェーズ

        console.log('🚀 Mastodon Visibility Modifier が初期化されました');
        console.log('⌨️ Shift+Command+Enter: プライベート投稿として送信');
        console.log('⌨️ Command+Enter: 通常の投稿として送信');
    };

    // 自動初期化
    initializeVisibilityModifier();
})();
