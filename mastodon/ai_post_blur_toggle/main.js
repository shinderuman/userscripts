(function() {
    'use strict';

    // 共通ライブラリから関数を取得
    // 共通ライブラリから関数を取得
    const {
    } = unsafeWindow.MastodonCommon;

    const CONFIG = {
        TARGET_IMAGE_SELECTOR: 'div.drawer__inner__mastodon > img',
        AI_POSTS_SELECTOR: '.split-column article',
        BLUR_FILTER: 'blur(10px)'
    };

    const blurAIPosts = () => {
        document.querySelectorAll(CONFIG.AI_POSTS_SELECTOR).forEach(element => {
            element.style.filter = element.style.filter ? '' : CONFIG.BLUR_FILTER;
        });
    };

    const initializeBlurSensitiveContents = () => {
        const observer = new MutationObserver(() => {
            const targetImage = document.querySelector(CONFIG.TARGET_IMAGE_SELECTOR);
            if (targetImage) {
                targetImage.parentNode.addEventListener('click', blurAIPosts);
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log('🚀 Mastodon Blur Sensitive Contents が初期化されました');
    };

    // グローバル関数として公開
    unsafeWindow.initializeBlurSensitiveContents = initializeBlurSensitiveContents;

    // 自動初期化
    initializeBlurSensitiveContents();
})();