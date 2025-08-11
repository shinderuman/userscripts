(function() {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        waitForElement
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        MENU_BUTTON_SELECTOR: "button.kw-rd-chrome-dot-menu-btn",
        FIRST_PAGE_SELECTOR: "#readerDotMenuCover",
        REF_PARAMETER: 'kwrp_m_d_ea_nis_r',
        TRIGGER_KEY: '0'
    };

    // GETパラメータに特定の値があるかどうかを確認
    const isReferredWithParameter = () => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('ref_') && urlParams.get('ref_') === CONFIG.REF_PARAMETER;
    };

    // ページがリロードされたかどうかを確認
    const isPageReload = () => {
        return performance.navigation.type === performance.navigation.TYPE_RELOAD;
    };

    // 最初のページに移動
    const navigateToFirstPage = () => {
        const menuButton = document.querySelector(CONFIG.MENU_BUTTON_SELECTOR);
        if (menuButton) {
            menuButton.click();
            waitForFirstPageButton();
        }
    };

    // メニューのボタンがレンダリングされるのを監視
    const observeForMenuButton = () => {
        if (!isPageReload()) {
            observeElement(CONFIG.MENU_BUTTON_SELECTOR, navigateToFirstPage);
        }
    };

    // 最初のページのボタンがレンダリングされるのを監視
    const waitForFirstPageButton = () => {
        observeElement(CONFIG.FIRST_PAGE_SELECTOR, clickFirstPageButton);
    };

    // 要素が見つかったらコールバックを実行するための共通関数
    const observeElement = (selector, callback) => {
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                callback(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    };

    // 最初のページのボタンをクリック
    const clickFirstPageButton = (button) => {
        button.click();
    };

    // キーボードイベントハンドラ
    const handleKeydown = (e) => {
        if (e.key === CONFIG.TRIGGER_KEY) {
            navigateToFirstPage();
        }
    };

    // 初期化処理
    const initializeMangaFirstOpenPage = () => {
        if (isReferredWithParameter()) {
            observeForMenuButton();
        }

        document.addEventListener('keydown', handleKeydown);
        
        console.log("📖 Kindle Manga First Open Page が初期化されました");
        console.log(`💡 '${CONFIG.TRIGGER_KEY}'キーで最初のページに移動できます`);
    };

    // グローバル関数として公開
    unsafeWindow.initializeMangaFirstOpenPage = initializeMangaFirstOpenPage;

    console.log("🚀 Kindle Manga First Open Page が読み込まれました");
    console.log("💡 自動的に初期化されます");

    // 自動初期化
    initializeMangaFirstOpenPage();
})();