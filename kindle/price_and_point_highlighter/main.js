(function () {
    'use strict';

    const {
        COMMON_CONFIG,
        COMMON_SELECTORS,
        getElementText,
        getBookAvailability,
        isBadgeExpired,
        fetchKindleInfoForPaper,
        waitForRenderedProductInfo,
        extractAsinFromUrl,
        evaluateSeriesSaleConditions,
        extractAmazonSeriesInfo,
        evaluateSaleConditions
    } = unsafeWindow.KindleCommon;

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
        asin: "#ASIN, input[name='idx.asin'], input[name='ASIN.0'], input[name='titleID']"
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
            extractAsinFromUrl(window.location.href)
        );
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

    const evaluateConditions = (productInfo) => {
        const conditions = evaluateSaleConditions(productInfo);

        if (productInfo.hasCoupon && productInfo.couponText) {
            return conditions.replace(
                '✅クーポンあり',
                `✅クーポンあり (${productInfo.couponText})`
            );
        }

        return conditions || '';
    };

    const checkSeriesConditions = () => {
        const info = extractAmazonSeriesInfo(document);
        if (!info) return null;
        console.log(
            '📊 シリーズ情報 - 冊数:',
            info.bookCount,
            '価格:',
            info.seriesPrice,
            'ポイント:',
            info.seriesPoints,
            'シリーズクーポン:',
            info.hasSeriesCoupon
        );
        return evaluateSeriesSaleConditions(info);
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

    const checkConditions = async () => {
        const displayedInfo = await waitForRenderedProductInfo(
            document,
            window.location.href
        );
        const productInfo = await fetchKindleInfoForPaper(displayedInfo);
        const title =
            productInfo.title ||
            getElementText(document.querySelector(SELECTORS.seriesTitle)) ||
            '商品タイトル不明';
        const detail =
            evaluateConditions(productInfo) || checkSeriesConditions();

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
        const { paperBookAvailable, kindleBookAvailable } =
            getBookAvailability(document);
        const markedASINs = getMarkedASINs();

        if (isBadgeExpired(markedASINs[asin], CONFIG.BADGE_EXPIRATION)) {
            return;
        }

        if (paperBookAvailable && kindleBookAvailable) {
            addBadgeToFavicon('aqua');
            saveMarkedASINs(Date.now().toString());
        }
    };

    const initializePriceAndPointHighlighter = async () => {
        asin = getASIN();
        if (!asin) return;

        clearNotifiedASINsDaily();
        clearExpiredMarkedASINs();
        (await checkConditions()) || checkAndApplyBadgeForKindleAvailability();

        console.log('🚀 Kindle Price and Point Highlighter が初期化されました');
    };

    initializePriceAndPointHighlighter().catch((error) =>
        console.error('❌ 価格・ポイントの取得に失敗しました:', error)
    );
})();
