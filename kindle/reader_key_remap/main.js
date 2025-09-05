/* eslint-disable no-undef */
(function () {
    'use strict';

    // キーバインド設定（変更可能）
    const KEY_BINDINGS = {
        PREV_PAGE: 'KeyZ',  // 前のページ
        NEXT_PAGE: 'KeyX'   // 次のページ
    };

    const selectors = {
        next: [
            '.kr-chevron-container-right',
            '.chevron-container.right',
            '[class*="chevron"][class*="right"]',
            '[class*="next"]',
            '[aria-label*="次"]',
            '[aria-label*="Next"]'
        ],
        prev: [
            '.kr-chevron-container-left',
            '.chevron-container.left',
            '[class*="chevron"][class*="left"]',
            '[class*="prev"]',
            '[aria-label*="前"]',
            '[aria-label*="Previous"]'
        ]
    };

    // Chevron要素を直接クリックしてページ送りを行う
    const clickChevron = (direction) => {
        try {
            for (const selector of selectors[direction]) {
                const element = document.querySelector(selector);
                if (element) {
                    // 複数の方法でクリックを試す
                    element.click();
                    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

                    return true;
                }
            }

            console.warn(`⚠️ ${direction === 'next' ? '次' : '前'}ページボタンが見つかりません`);
            return false;

        } catch (error) {
            console.error(`Error in clickChevron(${direction}):`, error);
            return false;
        }
    };

    // キーボードイベントリスナーを設定
    const setupKeyRemapping = () => {
        document.addEventListener('keydown', (e) => {
            // 前のページキー 単独
            if (e.code === KEY_BINDINGS.PREV_PAGE && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                clickChevron('prev');
            }

            // 次のページキー 単独
            if (e.code === KEY_BINDINGS.NEXT_PAGE && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                clickChevron('next');
            }
        }, true); // useCapture = true で早期キャッチ
    };

    // 初期化
    const initializeKeyRemap = () => {
        setupKeyRemapping();
        console.log('🚀 Amazon Reader Key Remap が読み込まれました');
        console.log(`💡 ${KEY_BINDINGS.PREV_PAGE.replace('Key', '')}キー → 前のページ、${KEY_BINDINGS.NEXT_PAGE.replace('Key', '')}キー → 次のページ`);
    };

    // グローバル関数として公開（デベロッパーツールから呼び出し可能）
    unsafeWindow.initializeKeyRemap = initializeKeyRemap;

    // 自動初期化
    initializeKeyRemap();
})();