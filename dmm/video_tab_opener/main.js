(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        observeDOM,
        modifyLink,
        extractUrlFromOnclick,
        markAsProcessed,
        isProcessed
    } = unsafeWindow.DMMCommon;

    const CONFIG = {
        LINK_SELECTOR: 'a[href^="javascript:void(0)"][onclick*="window.open"]'
    };

    const processLinks = () => {
        const links = document.querySelectorAll(CONFIG.LINK_SELECTOR);
        
        links.forEach(link => {
            if (isProcessed(link)) return;
            
            markAsProcessed(link);

            const onclick = link.getAttribute('onclick');
            const url = extractUrlFromOnclick(onclick);
            
            if (url) {
                modifyLink(link, url);
            }
        });
    };

    const initializePlayerOpenTab = () => {
        observeDOM(processLinks);
        console.log("🚀 DMM Player Open Tab が初期化されました");
        console.log("💡 DMM動画を新しいタブで開くように変更します");
    };

    // グローバル関数として公開
    unsafeWindow.initializePlayerOpenTab = initializePlayerOpenTab;

    console.log("🚀 DMM Player Open Tab が読み込まれました");
    console.log("💡 自動的に初期化されます");

    // 自動初期化
    initializePlayerOpenTab();
})();