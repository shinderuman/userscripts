(function() {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        getCurrentUsername
    } = unsafeWindow.MastodonCommon;

    const CONFIG = {
        USERNAME: 'asmodeus',
        HOME_COLUMN_SELECTOR: 'div[aria-label="ホーム"]',
        COMPOSE_TEXTAREA_SELECTOR: 'form > div.compose-form__highlightable > div.compose-form__scrollable > div > textarea'
    };

    const getRecentTootElement = () => {
        for (const article of document.querySelectorAll(`${CONFIG.HOME_COLUMN_SELECTOR} article`)) {
            if (article.querySelector('span.display-name__account')?.textContent.trim() === `@${CONFIG.USERNAME}`) {
                return article;
            }
        }
        return null;
    };

    const replyToRecentToot = (recentToot) => {
        const replyButton = recentToot.querySelector('button[title$="返信"]');
        if (replyButton) {
            replyButton.click();
        }
    };

    const editRecentToot = (recentToot) => {
        const menuButton = recentToot.querySelector('button[title="もっと見る"]');
        if (menuButton) {
            menuButton.click();
            observeDropdownMenuForEdit();
        }
    };

    const observeDropdownMenuForEdit = () => {
        const observer = new MutationObserver(() => {
            const editButton = Array.from(document.querySelectorAll('div.dropdown-menu__container > ul > li.dropdown-menu__item > a')).find(a => a.textContent.trim() === '編集');

            if (editButton) {
                editButton.click();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    const isTextareaEmpty = () => {
        const textarea = document.querySelector(CONFIG.COMPOSE_TEXTAREA_SELECTOR);
        return textarea?.value.trim() === '';
    };

    const handleKeyboardShortcuts = (event) => {
        if (!isTextareaEmpty()) return;

        if (event.metaKey && event.key === 'ArrowUp') {
            const recentToot = getRecentTootElement();
            if (!recentToot) return;

            if (event.shiftKey) {
                replyToRecentToot(recentToot);
            } else {
                editRecentToot(recentToot);
            }
            event.preventDefault();
        }
    };

    const initializeRecentPostEditor = () => {
        document.addEventListener('keydown', handleKeyboardShortcuts);
        console.log("⌨️ キーボードショートカットが有効になりました:");
        console.log("  Command+↑: 最新の投稿を編集");
        console.log("  Command+Shift+↑: 最新の投稿にリプライ");
    };

    // グローバル関数として公開
    unsafeWindow.initializeRecentPostEditor = initializeRecentPostEditor;



    // 自動初期化
    initializeRecentPostEditor();
})();