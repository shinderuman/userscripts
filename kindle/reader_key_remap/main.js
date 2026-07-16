(function () {
    'use strict';

    // キーバインド設定（変更可能）
    const KEY_BINDINGS = {
        PREV_PAGE: 'KeyZ', // 前のページ
        NEXT_PAGE: 'KeyX', // 次のページ
        NEXT_VOLUME: 'KeyA', // 次の巻
        FIRST_PAGE: 'Digit0' // 最初のページ
    };

    const SELECTORS = {
        CHEVRON_NEXT: '.kr-chevron-container-right',
        CHEVRON_PREV: '.kr-chevron-container-left',
        MENU_BUTTON: 'button.kw-rd-chrome-dot-menu-btn',
        FIRST_PAGE_BUTTON: '#readerDotMenuCover',
        MORE_BUTTON: '#readerChromeTitleBar > div > button',
        READ_BUTTON: 'button[data-testid=read-button]',
        READER_CONTAINER: '#reader'
    };

    // グローバルなイベントリスナー参照
    let keydownListener = null;

    // Chevron要素を直接クリックしてページ送りを行う
    const clickChevron = (direction) => {
        try {
            const container = document.querySelector(
                SELECTORS.READER_CONTAINER
            );
            const activeContainer =
                container &&
                container.offsetWidth > 0 &&
                container.offsetHeight > 0
                    ? container
                    : document;
            const selector =
                direction === 'next'
                    ? SELECTORS.CHEVRON_NEXT
                    : SELECTORS.CHEVRON_PREV;
            const elements = activeContainer.querySelectorAll(selector);

            if (elements.length > 0) {
                // 表示されている要素をフィルタリング
                const visibleElements = Array.from(elements).filter(
                    (element) => {
                        const rect = element.getBoundingClientRect();
                        const isInViewport =
                            rect.width > 0 &&
                            rect.height > 0 &&
                            rect.top >= 0 &&
                            rect.left >= 0;
                        const computedStyle = window.getComputedStyle(element);
                        const isDisplayed =
                            computedStyle.display !== 'none' &&
                            computedStyle.visibility !== 'hidden' &&
                            computedStyle.opacity !== '0';
                        return isInViewport && isDisplayed;
                    }
                );

                if (visibleElements.length > 0) {
                    // 最後の要素（最新の巻）を選択
                    const targetElement =
                        visibleElements[visibleElements.length - 1];

                    // 複数の方法でクリックを試す（重要）
                    targetElement.click();
                    targetElement.dispatchEvent(
                        new MouseEvent('click', { bubbles: true })
                    );
                    targetElement.dispatchEvent(
                        new MouseEvent('mousedown', { bubbles: true })
                    );
                    targetElement.dispatchEvent(
                        new MouseEvent('mouseup', { bubbles: true })
                    );

                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(`Error in clickChevron(${direction}):`, error);
            return false;
        }
    };

    // 次の巻を開く
    const openNextVolume = () => {
        // 「さらに読む」ボタンをクリック
        const moreButton = document.querySelector(SELECTORS.MORE_BUTTON);
        if (!moreButton) return false;

        moreButton.click();

        // 100ms間隔で最大50回（5秒間）チェック
        let attempts = 0;
        const maxAttempts = 50;
        const intervalId = setInterval(() => {
            attempts++;
            if (checkForReadButton() || attempts >= maxAttempts) {
                clearInterval(intervalId);
            }
        }, 100);

        return true;
    };

    // 定期的に「今すぐ読む」ボタンをチェック
    const checkForReadButton = () => {
        const readButton = document.querySelector(SELECTORS.READ_BUTTON);
        if (readButton) {
            readButton.click();
            return true;
        }
        return false;
    };

    // 最初のページに移動
    const navigateToFirstPage = () => {
        const menuButton = document.querySelector(SELECTORS.MENU_BUTTON);
        if (!menuButton) return false;

        menuButton.click();

        // MutationObserverで最初のページボタンの出現を監視
        const observer = new MutationObserver((mutations, obs) => {
            const firstPageButton = document.querySelector(
                SELECTORS.FIRST_PAGE_BUTTON
            );
            if (firstPageButton) {
                firstPageButton.click();
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return true;
    };

    // キーボードイベントリスナーを設定
    const setupKeyRemapping = () => {
        // 既存のリスナーを削除
        if (keydownListener) {
            document.removeEventListener('keydown', keydownListener, true);
        }

        // 新しいリスナーを作成
        keydownListener = (e) => {
            // 修飾キーが押されている場合は何もしない
            if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;

            // 前のページキー
            if (e.code === KEY_BINDINGS.PREV_PAGE) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                clickChevron('prev');
            }

            // 次のページキー
            if (e.code === KEY_BINDINGS.NEXT_PAGE) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                clickChevron('next');
            }

            // 次の巻キー
            if (e.code === KEY_BINDINGS.NEXT_VOLUME) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                openNextVolume();
            }

            // 最初のページキー
            if (e.code === KEY_BINDINGS.FIRST_PAGE) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                navigateToFirstPage();
            }
        };

        // 新しいリスナーを追加
        document.addEventListener('keydown', keydownListener, true);
    };

    // URL変更監視（MutationObserver使用）
    const monitorUrlChanges = () => {
        let lastUrl = window.location.href;

        const handleUrlChange = () => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                setTimeout(() => setupKeyRemapping(), 500);
            }
        };

        // MutationObserverでDOM変更を監視
        const observer = new MutationObserver(handleUrlChange);
        observer.observe(document, {
            childList: true,
            subtree: true
        });

        // popstateイベントでも監視
        window.addEventListener('popstate', handleUrlChange);
    };

    // 初期化
    const initializeKindleReader = () => {
        setupKeyRemapping();
        monitorUrlChanges();
        console.log('🚀 Amazon Kindle Reader が読み込まれました');
        console.log(
            `💡 ${KEY_BINDINGS.PREV_PAGE.replace('Key', '')}キー → 前のページ、${KEY_BINDINGS.NEXT_PAGE.replace('Key', '')}キー → 次のページ、${KEY_BINDINGS.NEXT_VOLUME.replace('Key', '')}キー → 次の巻、${KEY_BINDINGS.FIRST_PAGE.replace('Digit', '')}キー → 最初のページ`
        );
    };

    // 自動初期化
    initializeKindleReader();
})();
