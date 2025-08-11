(function() {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        applyStyles,
        addBadgeToFavicon
    } = unsafeWindow.AmazonCommon;

    const CONFIG = {
        HIGHLIGHT_CONFIGS: [
            {
                title: 'てさぐれ',
                priceThreshold: 4000,
            },
            {
                title: '世話やき',
                priceThreshold: 5000,
            },
            {
                title: '魔法少女',
                priceThreshold: 10000,
            },
        ],
        STYLES: {
            highlightedItem: {
                backgroundColor: 'yellow',
                color: 'red',
                fontWeight: 'bold',
                fontSize: '1.5em',
                border: '3px solid red',
                padding: '5px',
                borderRadius: '10px',
                boxShadow: '0 0 10px red',
                textTransform: 'uppercase',
            },
            navbar: {
                backgroundColor: '#900090',
                color: 'white',
            },
        },
        SELECTORS: {
            items: 'li.g-item-sortable',
            title: 'h2',
            navbar: '#nav-belt'
        },
        BADGE_COLOR: '#900090'
    };

    const highlightItems = () => {
        let firstHighlightedItem = null;

        document.querySelectorAll(CONFIG.SELECTORS.items).forEach(item => {
            const titleElement = item.querySelector(CONFIG.SELECTORS.title);
            if (!titleElement) return;

            CONFIG.HIGHLIGHT_CONFIGS.forEach(config => {
                const itemPrice = parseFloat(item.getAttribute('data-price'));
                if (titleElement.textContent.trim().startsWith(config.title) && itemPrice <= config.priceThreshold) {
                    applyStyles(titleElement, CONFIG.STYLES.highlightedItem);
                    if (!firstHighlightedItem) {
                        firstHighlightedItem = item;
                    }
                }
            });
        });

        if (firstHighlightedItem) {
            firstHighlightedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        return firstHighlightedItem;
    };

    const highlightNavbar = () => {
        const navbar = document.querySelector(CONFIG.SELECTORS.navbar);
        if (navbar) {
            applyStyles(navbar, CONFIG.STYLES.navbar);
        }
    };

    const initializeHighlight = () => {
        const hasHighlightedItems = highlightItems();
        
        if (hasHighlightedItems) {
            highlightNavbar();
            addBadgeToFavicon(CONFIG.BADGE_COLOR);
            console.log("🎯 アイテムがハイライトされました");
        }

        console.log("🚀 Amazon Highlight が初期化されました");
    };

    // グローバル関数として公開
    unsafeWindow.initializeHighlight = initializeHighlight;

    console.log("🚀 Amazon Highlight が読み込まれました");
    console.log("💡 自動的に初期化されます");

    // 自動初期化
    initializeHighlight();
})();