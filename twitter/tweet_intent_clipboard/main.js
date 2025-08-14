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

    // ニコニコ動画専用のテキスト生成
    const handleNicovideoShare = async () => {
        const pageTitle = document.title || '';
        const pageUrl = window.location.href;

        // ニコニコ動画専用フォーマット
        const fullText = `${pageTitle}${pageUrl}#ニコニコ動画\n\n`;

        const success = await copyToClipboard(fullText);
        if (success) {
            showToast('X Intent Copier', fullText, pageUrl);
        }
    };

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

    // 基本のintent URLリンク検出
    const handleDirectIntentLink = (event) => {
        const selector = INTENT_PATTERNS.map(pattern => `a[href*="${pattern}"]`).join(', ');
        const target = event.target.closest(selector);
        if (target) {
            event.preventDefault();
            event.stopPropagation();
            handleIntentClick(target.href);
            return true;
        }
        return false;
    };

    // サイト固有の処理
    const handleSiteSpecificShare = (event) => {
        // ニコニコ動画の「ポストする」ボタン
        if (window.location.hostname.includes('nicovideo.jp')) {
            const nicoPostButton = event.target.closest('button');
            if (nicoPostButton && nicoPostButton.textContent?.includes('ポストする')) {
                event.preventDefault();
                event.stopPropagation();
                handleNicovideoShare();
                return true;
            }
        }
        return false;
    };

    // シンプルなTwitterシェアボタンの検出
    const handleGenericTwitterShare = (event) => {
        const shareElement = event.target.closest('.twitter, [onclick*="twitter"]');
        if (shareElement &&
            (shareElement.className.includes('twitter') ||
                shareElement.onclick?.toString().includes('twitter'))) {

            event.preventDefault();
            event.stopPropagation();

            // ページ情報からintent URLを生成
            const pageTitle = document.title || '';
            const pageUrl = window.location.href;
            const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent(pageUrl)}`;

            handleIntentClick(intentUrl);
            return true;
        }
        return false;
    };

    const initializeIntentCopier = () => {
        // クリックイベントリスナー
        document.addEventListener('click', (event) => {
            // 優先度順に処理
            if (handleDirectIntentLink(event)) return;
            if (handleSiteSpecificShare(event)) return;
            if (handleGenericTwitterShare(event)) return;
        }, true);

        // window.openのオーバーライド
        const originalOpen = window.open;
        window.open = function (url, ...args) {
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

    // 自動初期化
    initializeIntentCopier();
})();