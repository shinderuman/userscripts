(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        COMMON_CONFIG,
        COMMON_SELECTORS,
        extractAmazonProductInfo,
        evaluateSaleConditions
    } = unsafeWindow.KindleCommon;

    // グローバル設定を取得
    const globalConfig = unsafeWindow.GlobalConfig || {};

    const CONFIG = {
        ...COMMON_CONFIG,
        LOCAL_STORAGE_KEYS: {
            LAST_CLEAR_DATE: 'lastClearDate',
            LAST_MARKED_CLEANUP_DATE: 'lastMarkedCleanupDate',
            NOTIFIED: 'notifiedASINs',
            MARKED: 'markedASINs'
        }
    };

    const SELECTORS = {
        ...COMMON_SELECTORS,
        favicon: "link[rel*='icon'], link[rel='shortcut icon']",
        navbar: '#nav-belt',
        postTrigger: '#nav-logo',
        seriesTitle: '#collection-masthead__title',
        asin: "#ASIN, input[name='idx.asin'], input[name='ASIN.0'], input[name='titleID']",
        offerButtons: 'button[id^="offer-tab-button_offer_"]',
        offerButtonTotal: 'div > span',
        offerButtonPrice: 'div > div > span',
        offerBuyBox: '[data-offer-id="offer_{OFFER_NUMBER}"] #buy-box',
        buyBoxPoints:
            'div.a-row.a-spacing-mini > div.a-column.a-span7.a-text-right.a-span-last > span',
        accordionRow: '[data-a-accordion-row-name], [data-accordion-id]',
        accordionHeader: '.a-heading-text, h3'
    };

    const PATTERNS = {
        offerButtonId: /offer-tab-button_offer_(\d+)/,
        totalBooks: [
            /購入可能な全\s*(\d+)\s*冊/,
            /残りの全\s*(\d+)\s*冊/,
            /次の(\d+)冊/,
            /(\d+)冊すべて/
        ],
        seriesPrice: /(\d+(?:,\d+)*)/,
        seriesPoints: /(\d+(?:,\d+)*)\s*pt/,
        points: /(\d+)pt/,
        price: /([\d,]+)/,
        asinFromUrl:
            /\/(?:dp|gp\/product|kindle-dbs\/product)\/([A-Z0-9]{10})[/?]?/
    };

    let asin = null;

    const getMarkedASINs = () => {
        const data = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.MARKED);
        return data ? JSON.parse(data) : {};
    };

    const saveMarkedASINs = (timestamp) => {
        const asins = getMarkedASINs();
        if (asins[asin]) return;
        asins[asin] = timestamp;
        localStorage.setItem(
            CONFIG.LOCAL_STORAGE_KEYS.MARKED,
            JSON.stringify(asins)
        );
    };

    const isBadgeExpired = (timestamp) => {
        if (!timestamp) return false;
        return Date.now() - Number(timestamp) >= CONFIG.BADGE_EXPIRATION;
    };

    const createMessage = (title, detail) => {
        const url = new URL(window.location.href);
        const productUrl = `${url.protocol}//${url.hostname}/dp/${asin}${CONFIG.AFFILIATE_PARAMS}`;
        return `
📚 セール情報: ${title}
条件達成:  ${detail}
${productUrl}
        `.trim();
    };

    const getASIN = () => {
        return (
            document.querySelector(SELECTORS.asin)?.value ||
            extractASINFromURL()
        );
    };

    const extractASINFromURL = () => {
        const match = window.location.href.match(PATTERNS.asinFromUrl);
        return match ? match[1] : null;
    };

    const isNotified = () => {
        return JSON.parse(
            localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.NOTIFIED) || '[]'
        ).includes(asin);
    };

    const markAsNotified = () => {
        const notifiedASINs = JSON.parse(
            localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.NOTIFIED) || '[]'
        );
        if (!notifiedASINs.includes(asin)) {
            notifiedASINs.push(asin);
            localStorage.setItem(
                CONFIG.LOCAL_STORAGE_KEYS.NOTIFIED,
                JSON.stringify(notifiedASINs)
            );
        }
    };

    const clearNotifiedASINsDaily = () => {
        const lastClearDate = localStorage.getItem(
            CONFIG.LOCAL_STORAGE_KEYS.LAST_CLEAR_DATE
        );
        const today = new Date().toISOString().split('T')[0];

        if (lastClearDate !== today) {
            localStorage.removeItem(CONFIG.LOCAL_STORAGE_KEYS.NOTIFIED);
            localStorage.setItem(
                CONFIG.LOCAL_STORAGE_KEYS.LAST_CLEAR_DATE,
                today
            );
        }
    };

    const clearExpiredMarkedASINs = () => {
        const lastCleanupDate = localStorage.getItem(
            CONFIG.LOCAL_STORAGE_KEYS.LAST_MARKED_CLEANUP_DATE
        );
        const today = new Date().toISOString().split('T')[0];

        if (lastCleanupDate !== today) {
            const asins = getMarkedASINs();
            const expirationTime = Date.now() - CONFIG.MARKED_ASINS_EXPIRATION;
            const validAsins = {};

            for (const [asin, timestamp] of Object.entries(asins)) {
                if (Number(timestamp) >= expirationTime) {
                    validAsins[asin] = timestamp;
                }
            }

            localStorage.setItem(
                CONFIG.LOCAL_STORAGE_KEYS.MARKED,
                JSON.stringify(validAsins)
            );
            localStorage.setItem(
                CONFIG.LOCAL_STORAGE_KEYS.LAST_MARKED_CLEANUP_DATE,
                today
            );
        }
    };

    const highlightNavbar = () => {
        const navbar = document.querySelector(SELECTORS.navbar);
        if (navbar) {
            navbar.style.backgroundColor = '#ff0000';
            navbar.style.color = 'white';
        }
    };

    const addBadgeToFavicon = (color) => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.src =
            document.querySelector(SELECTORS.favicon)?.href ||
            'https://www.amazon.co.jp/favicon.ico';
        img.onload = () => {
            ctx.drawImage(img, 0, 0, 32, 32);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(24, 8, 8, 0, 2 * Math.PI);
            ctx.fill();

            const newFavicon = canvas.toDataURL('image/png');
            changeFavicon(newFavicon);
        };
    };

    const changeFavicon = (url) => {
        let link = document.querySelector(SELECTORS.favicon);
        if (link) {
            link.href = url;
        } else {
            link = document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = url;
            document.head.appendChild(link);
        }
    };

    const sendNotification = (title, body) => {
        GM_notification({
            title: title,
            text: body,
            image: 'https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp',
            timeout: 0,
            onclick: () => {
                window.focus();
                postToAllPlatforms(title, body);
            }
        });
    };

    const postToAllPlatforms = (title, detail) => {
        const message = createMessage(title, detail);
        postToSlack(message);
        postToMastodon(message);

        GM_setClipboard(asin);
    };

    const postToSlack = (message) => {
        if (!globalConfig.slack?.token) return;
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://slack.com/api/chat.postMessage',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${globalConfig.slack.token}`
            },
            data: JSON.stringify({
                channel: globalConfig.slack.channelId,
                text: message
            }),
            onload: (response) => {
                const result = JSON.parse(response.responseText);
                if (result.ok) {
                    console.log('メッセージ送信成功:', result);
                } else {
                    console.error('メッセージ送信失敗:', result);
                }
            },
            onerror: (error) => console.error('リクエストエラー:', error)
        });
    };

    const postToMastodon = (status) => {
        if (!globalConfig.mastodon?.accessToken) return;
        GM_xmlhttpRequest({
            method: 'POST',
            url: globalConfig.mastodon.apiEndpoint,
            headers: {
                Authorization: `Bearer ${globalConfig.mastodon.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                status: status,
                visibility: 'public'
            }),
            onload: (response) => {
                if (response.status === 200 || response.status === 202) {
                    console.log(
                        '投稿に成功しました:',
                        JSON.parse(response.responseText)
                    );
                } else {
                    console.error('投稿に失敗しました:', response);
                }
            },
            onerror: (error) => {
                console.error('リクエストエラー:', error);
            }
        });
    };

    const evaluateConditions = () => {
        const productInfo = extractAmazonProductInfo(document);
        const conditions = evaluateSaleConditions(productInfo);

        // 共通関数ではクーポン詳細テキストが含まれないので、別途追加
        const couponInfo = getCouponInfo();
        if (couponInfo.hasCoupon && couponInfo.couponText) {
            return conditions.replace(
                '✅クーポンあり',
                `✅クーポンあり (${couponInfo.couponText})`
            );
        }

        return conditions || '';
    };

    // クーポン情報を取得する関数
    const getCouponInfo = () => {
        return {
            hasCoupon:
                document
                    .querySelector(SELECTORS.couponBadge)
                    ?.textContent?.includes('クーポン:') || false,
            couponText:
                document
                    .querySelector('.couponLabelText')
                    ?.firstChild?.textContent?.trim() || ''
        };
    };

    const checkSeriesConditions = () => {
        const maxOfferButton = getMaxOfferButton();
        if (!maxOfferButton) return null;

        const bookCount = getSeriesTotalFromButton(maxOfferButton);
        if (bookCount === 0) return null;

        const seriesPrice = getSeriesPriceFromButton(maxOfferButton);
        const seriesPoints = getSeriesPoints(maxOfferButton);
        const seriesCouponInfo = getSeriesCouponInfo(maxOfferButton);

        console.log(
            '📊 シリーズ情報 - 冊数:',
            bookCount,
            '価格:',
            seriesPrice,
            'ポイント:',
            seriesPoints,
            'シリーズクーポン:',
            seriesCouponInfo.hasSeriesCoupon
        );

        const conditions = [];
        if (seriesCouponInfo.hasSeriesCoupon) {
            conditions.push(
                `✅シリーズクーポンあり (${seriesCouponInfo.seriesCouponText})`
            );
        }
        if (seriesPoints >= COMMON_CONFIG.POINT_THRESHOLD) {
            conditions.push(`✅シリーズのポイントが ${seriesPoints}pt です。`);
        }

        if (bookCount > 0 && seriesPrice > 0) {
            const averagePrice = seriesPrice / bookCount;
            if (averagePrice <= COMMON_CONFIG.AVERAGE_PRICE_THRESHOLD) {
                conditions.push(
                    `${bookCount}冊が平均 ${averagePrice.toFixed(2)}円 で購入可能です。`
                );
            }
        }

        return conditions.length > 0 ? conditions.join(' ') : null;
    };

    const getMaxOfferButton = () => {
        const offerButtons = document.querySelectorAll(SELECTORS.offerButtons);
        let maxOfferButton = null;
        let maxOfferNumber = -1;

        offerButtons.forEach((button) => {
            const accordionRow = button.closest(SELECTORS.accordionRow);
            if (accordionRow) {
                const headerText = accordionRow.querySelector(
                    SELECTORS.accordionHeader
                );
                if (
                    headerText &&
                    headerText.textContent.includes('まとめ買い (話)')
                ) {
                    return;
                }
            }

            const match = button.id.match(PATTERNS.offerButtonId);
            if (match) {
                const offerNumber = parseInt(match[1]);
                if (offerNumber > maxOfferNumber) {
                    maxOfferNumber = offerNumber;
                    maxOfferButton = button;
                }
            }
        });

        return maxOfferButton;
    };

    const getSeriesTotalFromButton = (button) => {
        const totalSpan = button.querySelector(SELECTORS.offerButtonTotal);
        if (!totalSpan) return 0;

        const totalText = totalSpan.textContent;

        for (const pattern of PATTERNS.totalBooks) {
            const match = totalText.match(pattern);
            if (match) {
                return parseInt(match[1]);
            }
        }
        return 0;
    };

    const getSeriesPriceFromButton = (button) => {
        const priceSpan = button.querySelector(SELECTORS.offerButtonPrice);
        if (!priceSpan) return 0;

        const priceText = priceSpan.textContent;
        const priceMatch = priceText.match(PATTERNS.seriesPrice);
        if (priceMatch) {
            return parseInt(priceMatch[1].replace(/,/g, ''));
        }
        return 0;
    };

    const getSeriesPoints = (button) => {
        // buttonのIDからoffer IDを抽出
        const match = button.id.match(PATTERNS.offerButtonId);
        if (!match) return 0;

        // 対応するbuy-boxを探す
        const buyBoxSelector = SELECTORS.offerBuyBox.replace(
            '{OFFER_NUMBER}',
            match[1]
        );
        const buyBox = document.querySelector(buyBoxSelector);
        if (!buyBox) return 0;

        const pointsElement = buyBox.querySelector(SELECTORS.buyBoxPoints);
        if (pointsElement) {
            const pointsText = pointsElement.textContent;
            const pointsMatch = pointsText.match(PATTERNS.seriesPoints);
            if (pointsMatch) {
                return parseInt(pointsMatch[1].replace(/,/g, ''));
            }
        }
        return 0;
    };

    // シリーズ用のクーポン情報を取得する関数
    const getSeriesCouponInfo = (maxOfferButton) => {
        if (!maxOfferButton) {
            return { hasSeriesCoupon: false, seriesCouponText: '' };
        }

        // maxOfferButtonからoffer IDを抽出
        const match = maxOfferButton.id.match(PATTERNS.offerButtonId);
        if (!match) {
            return { hasSeriesCoupon: false, seriesCouponText: '' };
        }

        const offerNumber = match[1];

        // 対応するbuy-box内のクーポン情報を取得
        const buyBoxSelector = SELECTORS.offerBuyBox.replace(
            '{OFFER_NUMBER}',
            offerNumber
        );
        const buyBox = document.querySelector(buyBoxSelector);

        if (!buyBox) {
            return { hasSeriesCoupon: false, seriesCouponText: '' };
        }

        const couponElement = buyBox.querySelector(
            '._hulk-buy-card_buyBox_coupon-message__3BUsi'
        );
        const hasSeriesCoupon = !!couponElement;
        const seriesCouponText = couponElement?.textContent?.trim() || '';

        return {
            hasSeriesCoupon,
            seriesCouponText
        };
    };

    const addPostClickHandler = (title, detail) => {
        const clickTarget = document.querySelector(SELECTORS.postTrigger);
        if (clickTarget) {
            clickTarget.addEventListener('click', (e) => {
                e.preventDefault();
                postToAllPlatforms(title, detail);
            });
        }
    };

    const checkConditions = () => {
        const productInfo = extractAmazonProductInfo(document);
        const title =
            productInfo.title ||
            document.querySelector(SELECTORS.seriesTitle)?.innerText.trim() ||
            '商品タイトル不明';
        const detail = evaluateConditions() || checkSeriesConditions();

        if (detail) {
            highlightNavbar();
            addBadgeToFavicon('red');
            addPostClickHandler(title, detail);
            if (!isNotified()) {
                sendNotification(title, detail);
                markAsNotified();
            }
            return true;
        }
        return false;
    };

    const checkAndApplyBadgeForKindleAvailability = () => {
        const paperBookAvailable = document.querySelector(
            SELECTORS.paperBookAvailable
        );
        const kindleBookAvailable = document.querySelector(
            SELECTORS.kindleBookAvailable
        );
        const markedASINs = getMarkedASINs();

        if (isBadgeExpired(markedASINs[asin])) {
            return;
        }

        if (paperBookAvailable && kindleBookAvailable) {
            addBadgeToFavicon('aqua');
            saveMarkedASINs(Date.now().toString());
        }
    };

    const initializePriceAndPointHighlighter = () => {
        asin = getASIN();
        if (!asin) return;

        clearNotifiedASINsDaily();
        clearExpiredMarkedASINs();
        checkConditions() || checkAndApplyBadgeForKindleAvailability();

        console.log('🚀 Kindle Price and Point Highlighter が初期化されました');
    };

    // 自動初期化
    initializePriceAndPointHighlighter();
})();
