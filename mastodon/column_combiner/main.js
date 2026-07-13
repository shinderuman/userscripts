(function() {
    'use strict';

    // 共通ライブラリから関数を取得
    // 共通ライブラリから関数を取得
    const {
    } = unsafeWindow.MastodonCommon;

    const COLUMN_PAIRS = [
        {
            topColumnName: '新しい投稿',
            bottomColumnName: '通知'
        },
        {
            topColumnName: '#gochisou_photo',
            bottomColumnName: '#文鳥'
        }
    ];

    const initializeColumnCombiner = () => {
        moveColumns();
    };

    const moveColumns = () => {
        COLUMN_PAIRS.forEach(pair => {
            const observer = new MutationObserver(() => {
                const topColumn = document.querySelector(`div[aria-label="${pair.topColumnName}"]`);
                const bottomColumn = document.querySelector(`div[aria-label="${pair.bottomColumnName}"]`);

                if (topColumn && bottomColumn) {
                    combineColumns(topColumn, bottomColumn);
                    observer.disconnect();
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    };

    const combineColumns = (topColumn, bottomColumn) => {
        const container = document.createElement('div');
        const parent = topColumn.parentElement;

        applyContainerStyles(container, parent);
        applyColumnStyles(topColumn);
        applyColumnStyles(bottomColumn);

        parent.insertBefore(container, topColumn);
        container.appendChild(topColumn);
        container.appendChild(bottomColumn);
    };

    const applyContainerStyles = (container, parent) => {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';

        if (parent.classList.contains('drawer')) {
            container.style.flex = '1 1 auto';
            container.style.minHeight = '0';
            container.style.width = '100%';
            return;
        }

        container.style.flex = '0 0 auto';
        container.style.height = '100%';
        container.style.width = '365px';
    };

    const applyColumnStyles = (column) => {
        column.style.flex = '1';
        column.style.overflowX = 'hidden';
        column.style.overflowY = 'auto';
        column.style.width = '100%';
    };

    // 自動初期化
    initializeColumnCombiner();
})();
