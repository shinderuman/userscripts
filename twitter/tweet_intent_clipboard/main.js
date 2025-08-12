(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        INTENT_PATTERNS,
        isIntentUrl,
        extractIntentParams,
        showToast,
        copyToClipboard
    } = unsafeWindow.TwitterCommon;

    const handleIntentClick = async (url) => {
        const { text, url: intentUrl, hashtags } = extractIntentParams(url);

        if (!intentUrl && !/https?:\/\/[^\s]+/.test(text)) {
            showToast('Error', 'Error: The URL parameter is missing or empty, and no URL is found in the text.', null, '#e74c3c', '#c0392b');
            return;
        }

        const fullText = `
${text}
${intentUrl}
${hashtags}
        `.trim() + '\n\n';

        const success = await copyToClipboard(fullText);
        if (success) {
            showToast('X Intent Copier', fullText, url);
        }
    };

    const initializeIntentCopier = () => {
        // クリックイベントリスナー
        document.addEventListener('click', (event) => {
            const selector = INTENT_PATTERNS.map(pattern => `a[href*="${pattern}"]`).join(', ');
            const target = event.target.closest(selector);
            if (target) {
                event.preventDefault();
                event.stopPropagation();
                handleIntentClick(target.href);
            }
        }, true);

        // window.openのオーバーライド
        const originalOpen = window.open;
        window.open = function(url, ...args) {
            if (url && isIntentUrl(url)) {
                handleIntentClick(url);
                return null;
            }
            return originalOpen.apply(this, [url, ...args]);
        };

        console.log("🚀 Twitter Intent Copier が初期化されました");
    };

    // グローバル関数として公開
    unsafeWindow.initializeIntentCopier = initializeIntentCopier;

    console.log("🚀 Twitter Intent Copier が読み込まれました");
    console.log("💡 自動的に初期化されます");

    // 自動初期化
    initializeIntentCopier();
})();