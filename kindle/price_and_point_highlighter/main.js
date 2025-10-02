(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        COMMON_CONFIG,
        getElementValue
    } = unsafeWindow.KindleCommon;

    // グローバル設定を取得
    const globalConfig = unsafeWindow.GlobalConfig || {};

    const CONFIG = {
        ...COMMON_CONFIG,
        LOCAL_STORAGE_KEYS: {
            LAST_CLEAR_DATE: 'lastClearDate',
            NOTIFIED: 'notifiedASINs',
            MARKED: 'markedASINs'
        }
    };

    const SELECTORS = {
        favicon: 'link[rel*=\'icon\'], link[rel=\'shortcut icon\']',
        navbar: '#nav-belt',
        postTrigger: '#nav-logo',
        title: '#productTitle',
        seriesTitle: '#collection-masthead__title',
        asin: '#ASIN, input[name=\'idx.asin\'], input[name=\'ASIN.0\'], input[name=\'titleID\']',
        kindlePrice: '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
        paperPrice: '[id^=\'tmm-grid-swatch\']:not([id$=\'KINDLE\']) > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
        points: '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span, #tmm-grid-swatch-OTHER > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span',
        ownershipVolume: '#hulk_buy_ownership_volume > span',
        kindleBookAvailable: '#tmm-grid-swatch-KINDLE',
        paperBookAvailable: '[id^=\'tmm-grid-swatch\']:not([id$=\'KINDLE\'])'
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
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.MARKED, JSON.stringify(asins));
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
        return document.querySelector(SELECTORS.asin)?.value || extractASINFromURL();
    };

    const extractASINFromURL = () => {
        const match = window.location.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})[/?]?/);
        return match ? match[1] : null;
    };

    const isNotified = () => {
        return JSON.parse(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.NOTIFIED) || '[]').includes(asin);
    };

    const markAsNotified = () => {
        const notifiedASINs = JSON.parse(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.NOTIFIED) || '[]');
        if (!notifiedASINs.includes(asin)) {
            notifiedASINs.push(asin);
            localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.NOTIFIED, JSON.stringify(notifiedASINs));
        }
    };

    const clearNotifiedASINsDaily = () => {
        const lastClearDate = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_CLEAR_DATE);
        const today = new Date().toISOString().split('T')[0];

        if (lastClearDate !== today) {
            localStorage.removeItem(CONFIG.LOCAL_STORAGE_KEYS.NOTIFIED);
            localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_CLEAR_DATE, today);
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
        img.src = document.querySelector(SELECTORS.favicon)?.href || 'https://www.amazon.co.jp/favicon.ico';
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
    };

    const postToSlack = (message) => {
        if (!globalConfig.slack?.token) return;
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://slack.com/api/chat.postMessage',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${globalConfig.slack.token}`
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
                'Authorization': `Bearer ${globalConfig.mastodon.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                status: status,
                visibility: 'public'
            }),
            onload: (response) => {
                if (response.status === 200 || response.status === 202) {
                    console.log('投稿に成功しました:', JSON.parse(response.responseText));
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
        const points = getElementValue(document, SELECTORS.points, /(\d+)pt/);
        const kindlePrice = getElementValue(document, SELECTORS.kindlePrice, /([\d,]+)/);
        const paperPrice = getElementValue(document, SELECTORS.paperPrice, /([\d,]+)/);

        const conditions = [];
        if (points >= CONFIG.POINT_THRESHOLD) {
            conditions.push(`✅ポイント ${points}pt`);
        }
        if (kindlePrice && (points / kindlePrice) * 100 >= CONFIG.POINTS_RATE_THRESHOLD) {
            conditions.push(`✅ポイント還元 ${(points / kindlePrice * 100).toFixed(2)}%`);
        }
        if (paperPrice && kindlePrice > 0 && paperPrice - kindlePrice >= CONFIG.POINT_THRESHOLD) {
            conditions.push(`✅価格差 ${paperPrice - kindlePrice}円`);
        }
        return conditions.join(' ');
    };

    const checkSeriesConditions = () => {
        const ownershipText = document.querySelector(SELECTORS.ownershipVolume)?.innerText;
        let total = 0;
        let purchased = 0;
        if (ownershipText) {
            [total, purchased] = ownershipText.match(/全(\d+)巻中(\d+)冊/).slice(1, 3).map(Number);
        }

        for (let i = 5; i >= 0; i--) {
            const seriesPoints = getElementValue(
                document,
                `#hulk_buy_points_COMPLETE_SERIES_VOLUME_volume_${i} > div.a-column.a-span6.a-text-right.a-span-last > div > div > span.a-size-small.a-text-bold`,
                /(\d+)pt/
            );
            if (seriesPoints >= CONFIG.POINT_THRESHOLD) {
                return `シリーズのポイントが ${seriesPoints}pt です。`;
            }

            const seriesPrice = getElementValue(
                document,
                `#hulk_buy_bundle_button_COMPLETE_SERIES_VOLUME_volume_${i}-announce > div > div > span`,
                /([\d,]+)/
            );

            if (!total) {
                total = getElementValue(
                    document,
                    `#hulk_buy_bundle_button_COMPLETE_SERIES_VOLUME_volume_${i}-announce > div > span`,
                    /(\d+)冊/
                );
                purchased = 0;
            }

            const restBooks = total - purchased;

            if (restBooks > 0 && seriesPrice > 0) {
                if (seriesPrice / restBooks <= CONFIG.AVERAGE_PRICE_THRESHOLD) {
                    return `残りの本が平均 ${(seriesPrice / restBooks).toFixed(2)}円 で購入可能です。`;
                } else {
                    return null;
                }
            }

        }
        return null;
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
        const title = document.querySelector(SELECTORS.title)?.innerText.trim() || document.querySelector(SELECTORS.seriesTitle)?.innerText.trim() || '商品タイトル不明';
        const detail = evaluateConditions();

        if (detail) {
            highlightNavbar();
            addBadgeToFavicon('red');
            addPostClickHandler(title, detail);
            if (!isNotified()) {
                sendNotification(title, detail);
                markAsNotified();
            }
            return true;
        } else if (checkSeriesConditions()) {
            highlightNavbar();
            addBadgeToFavicon('red');
            return true;
        }
        return false;
    };

    const checkAndApplyBadgeForKindleAvailability = () => {
        const paperBookAvailable = document.querySelector(SELECTORS.paperBookAvailable);
        const kindleBookAvailable = document.querySelector(SELECTORS.kindleBookAvailable);
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
        checkConditions() || checkAndApplyBadgeForKindleAvailability();

        console.log('🚀 Kindle Price and Point Highlighter が初期化されました');
    };

    // 自動初期化
    window.addEventListener('load', initializePriceAndPointHighlighter);
})();