(function () {
    'use strict';

    const CONFIG = {
        TARGET_SELECTOR: '#header > div > p'
    };

    const changePlayerTitle = () => {
        const titleElement = document.querySelector(CONFIG.TARGET_SELECTOR);
        if (titleElement && titleElement.textContent.trim()) {
            document.title = titleElement.textContent;
            return true;
        }
        return false;
    };

    const setupTitleChangeObserver = () => {
        // まず即時実行
        if (changePlayerTitle()) {
            return;
        }

        // ターゲット要素を取得
        const titleElement = document.querySelector(CONFIG.TARGET_SELECTOR);
        if (!titleElement) {
            return;
        }

        // pタグだけを監視
        const observer = new MutationObserver(() => {
            if (changePlayerTitle()) {
                observer.disconnect();
            }
        });

        observer.observe(titleElement, {
            characterData: true,
            childList: true
        });
    };

    const init = () => {
        console.log('🚀 DMM Video Player Title Changer を初期化');
        setupTitleChangeObserver();
    };

    init();
})();
