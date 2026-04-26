(function () {
    'use strict';

    const CONFIG = {
        INITIAL_WAIT_MS: 4000,
        TIMEOUT_MS: 20000,
        AD_CONTAINER_ID: 'nv_watch_VideoAdContainer'
    };

    let clicked = false;
    let timeoutId = null;

    const trySkipAd = () => {
        if (clicked) return;

        const container = document.getElementById(CONFIG.AD_CONTAINER_ID);
        if (!container) return;

        const skipButton = container.querySelector('button:not([disabled])');
        if (!skipButton) return;

        if (skipButton.textContent.trim() !== 'スキップする') return;

        clicked = true;
        clearTimeout(timeoutId);
        observer.disconnect();
        skipButton.click();
        console.log('⏩ 動画広告をスキップしました');
    };

    const observer = new MutationObserver(() => {
        const container = document.getElementById(CONFIG.AD_CONTAINER_ID);
        if (!container) {
            observer.disconnect();
            clearTimeout(timeoutId);
            return;
        }
        trySkipAd();
    });

    setTimeout(() => {
        timeoutId = setTimeout(() => {
            observer.disconnect();
            console.log('⏹ 監視をタイムアウトしました');
        }, CONFIG.TIMEOUT_MS);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        console.log('🚀 ニコニコ自動広告スキッパーが初期化されました');
    }, CONFIG.INITIAL_WAIT_MS);
})();
