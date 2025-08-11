(function() {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        waitForElements
    } = unsafeWindow.MastodonCommon;

    const COLUMN_PAIRS = [
        {
            topColumnName: '投稿の新規作成',
            bottomColumnName: '通知',
        },
        {
            topColumnName: '#gochisou_photo',
            bottomColumnName: '#文鳥',
        },
    ];

    const combineColumns = (topColumn, bottomColumn) => {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';

        topColumn.style.flex = '1';
        topColumn.style.overflow = 'auto';
        topColumn.style.width = '365px';
        
        bottomColumn.style.flex = '1';
        bottomColumn.style.overflow = 'auto';
        bottomColumn.style.width = '365px';

        topColumn.parentElement.insertBefore(container, topColumn);
        container.appendChild(topColumn);
        container.appendChild(bottomColumn);
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

    const initializeColumnCombiner = () => {
        moveColumns();
    };

    // グローバル関数として公開
    unsafeWindow.initializeColumnCombiner = initializeColumnCombiner;

    console.log("🚀 Mastodon Column Combiner が読み込まれました");
    console.log("💡 自動的に初期化されます");

    // 自動初期化
    initializeColumnCombiner();
})();