(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        copyToClipboard,
        openInTab,
        showNotification,
        preventDefaultKeys,
        cleanUrl
    } = unsafeWindow.UniversalCommon;

    const CONFIG = {
        SEARCH_ENGINE: 'https://www.google.com/search?q=',
        INTENT_URL_PATTERNS: [
            'twitter.com/intent/tweet',
            'twitter.com/share',
            'x.com/intent/post',
            'x.com/intent/tweet',
            'x.com/share',
        ],
        NAVIGATION_URLS: {
            ArrowLeft: 'https://abema.tv/timetable',
            ArrowDown: 'https://www.at-x.com/program',
            ArrowRight: 'https://koken.nicovideo.jp/campaign'
        },
        UNDESIRABLE_CHARS: [
            '(', ')', '（', '）', '【', '】', '〔', '〕'
        ],
        TAB_OPTIONS: {
            active: true,
            insert: true,
            setParent: true
        }
    };

    const getPageInfo = () => {
        const asin = document.querySelector("#ASIN, input[name='idx.asin'], input[name='ASIN.0'], input[name='titleID']")?.value;
        const title = document.querySelector('#productTitle')?.textContent.trim() ??
            document.querySelector('#collection-masthead__title')?.textContent.trim();
        return { asin, title };
    };

    const copyPageInfo = async () => {
        const title = document.title;
        const url = cleanUrl(window.location.href);
        const content = `${title}\n${url}`;

        const success = await copyToClipboard(content);
        if (success) {
            showNotification('Copied to Clipboard', `${title}\n${url}`, 3000);
        }
    };

    const handleAmazonSearch = () => {
        const { title } = getPageInfo();
        if (!title) return;

        const unwantedPatterns = [...Array(10).keys()].map(String)
            .concat(CONFIG.UNDESIRABLE_CHARS)
            .concat(getFullWidthDigits());

        const filteredTitle = unwantedPatterns.reduce(
            (title, pattern) => title.split(pattern)[0].trim(),
            title
        );

        openInTab(`${CONFIG.SEARCH_ENGINE}${encodeURIComponent(filteredTitle)}`, CONFIG.TAB_OPTIONS);
    };

    // ISBN判定関数
    const isISBN = (asin) => {
        if (!asin) return false;
        const length = asin.length;
        return (length >= 10 && length <= 13) && /^\d+$/.test(asin);
    };

    const copyProductInfo = async () => {
        const { asin, title } = getPageInfo();
        if (!asin || !title) return;

        const releaseDate = new Date(
            document.querySelector("#rpi-attribute-book_details-publication_date > div.a-section.a-spacing-none.a-text-center.rpi-attribute-value > span")
                ?.textContent.trim().replace(/\//g, '-')
        ).toISOString();

        const currentPrice = Number(
            document.querySelector("#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span")
                ?.textContent.replace(/[^\d]/g, '')
        ) || 0;

        const maxPrice = Number(
            document.querySelector("[id^='tmm-grid-swatch']:not([id$='KINDLE']) > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span")
                ?.textContent.replace(/[^\d]/g, '')
        ) || currentPrice;

        // ISBNの場合はURLを空にする
        const url = isISBN(asin) ? '' : `https://www.amazon.co.jp/dp/${asin}?tag=shinderuman03-22&linkCode=ogi&th=1&psc=1`;

        const productInfo = JSON.stringify({
            ASIN: asin,
            Title: title,
            ReleaseDate: releaseDate,
            CurrentPrice: currentPrice,
            MaxPrice: maxPrice,
            URL: url,
        }, null, 4) + ",";

        const success = await copyToClipboard(productInfo);
        if (success) {
            showNotification('Copied Product Info to Clipboard', `${asin}\n${title}`, 3000);
        }
    };

    const copyCollectionInfo = async () => {
        const match = location.href.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/);
        if (!match) return;

        const asin = match[1];
        const authors = getAuthors();

        let lines = ["{"];
        for (const name of authors) {
            lines.push(`"Name": "${name}",`);
        }
        lines.push(`"URL": "https://www.amazon.co.jp/dp/${asin}"`);
        lines.push("},\n");

        const success = await copyToClipboard(lines.join('\n'));
        if (success) {
            showNotification('Copied Collection Info to Clipboard', `${asin}\n${authors}`, 3000);
        }
    };

    const getAuthors = () => {
        const rawData = document.querySelector('#collection-masthead__author > span.a-declarative')?.getAttribute('data-a-popover');

        if (rawData) {
            const dataObj = JSON.parse(rawData);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = dataObj.inlineContent;
            return Array.from(tempDiv.querySelectorAll('a')).map(a =>
                a.textContent.replace('(著)', '').replace(',', '').replace('Other', '').trim()
            );
        } else {
            return [
                document.querySelector("#collection-masthead__author > a")?.textContent.replace('(著)', '').trim()
            ];
        }
    };

    const getFullWidthDigits = () => {
        const digits = [];
        for (let i = 0; i <= 9; i++) {
            digits.push(String.fromCharCode(i + 0xFF10));
        }
        return digits;
    };

    const handleKeyEvents = (event) => {
        if (event.metaKey && event.code === 'KeyT') {
            event.preventDefault();
            openInTab('vivaldi://startpage/', CONFIG.TAB_OPTIONS);
            return;
        }

        if (!event.altKey || event.metaKey || event.ctrlKey) return;
        preventDefaultKeys(event, ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

        switch (event.key) {
            case 'ArrowUp': {
                const button = document.querySelector(
                    CONFIG.INTENT_URL_PATTERNS.map(pattern => `a[href*="${pattern}"]`).join(', ')
                );
                if (event.shiftKey) {
                    copyPageInfo();
                } else if (button) {
                    button.click();
                } else if (window.location.href.startsWith('https://www.amazon.co.jp/')) {
                    const { asin } = getPageInfo();
                    if (asin) {
                        copyProductInfo();
                    } else {
                        copyCollectionInfo();
                    }
                } else {
                    copyPageInfo();
                }
                break;
            }
            case 'ArrowDown':
                openInTab(CONFIG.NAVIGATION_URLS.ArrowDown, CONFIG.TAB_OPTIONS);
                break;
            case 'ArrowLeft':
                openInTab(CONFIG.NAVIGATION_URLS.ArrowLeft, CONFIG.TAB_OPTIONS);
                break;
            case 'ArrowRight':
                if (window.location.href.startsWith('https://www.amazon.co.jp/')) {
                    handleAmazonSearch();
                } else {
                    window.open(CONFIG.NAVIGATION_URLS.ArrowRight, '_blank', 'width=800,height=1200,noopener,noreferrer');
                }
                break;
            default:
                break;
        }
    };

    const initializeCustomKeybindHandler = () => {
        document.addEventListener('keydown', handleKeyEvents);
        console.log("🚀 Custom Keybind Handler が初期化されました");
        console.log("💡 Alt+矢印キーで各種機能を使用できます");
    };

    // グローバル関数として公開
    unsafeWindow.initializeCustomKeybindHandler = initializeCustomKeybindHandler;

    // 自動初期化
    initializeCustomKeybindHandler();
})();