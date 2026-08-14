unsafeWindow.KindleCommon = (function () {
    'use strict';

    const COMMON_SELECTORS = {
        title: '#productTitle',
        kindleBookAvailable: '#tmm-grid-swatch-KINDLE',
        paperBookAvailable: "[id^='tmm-grid-swatch']:not([id$='KINDLE'])",
        couponBadge: 'i.a-icon.a-icon-addon.newCouponBadge',
        kindlePrice: [
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
            '#tmm-grid-swatch-OTHER > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
            '#kindle-price',
            '#a-autoid-2-announce > span.slot-price > span',
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-extraMessage .kindleExtraMessage .a-color-price'
        ].join(', '),
        kindlePriceInSwatch:
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
        kindlePurchasePrice: [
            '#tmm-grid-swatch-KINDLE .slot-extraMessage .kindleExtraMessage',
            '#tmm-grid-swatch-KINDLE .slot-extraMessage',
            '#tmm-grid-swatch-OTHER .slot-extraMessage .kindleExtraMessage',
            '#tmm-grid-swatch-OTHER .slot-extraMessage'
        ],
        paperPrice:
            "[id^='tmm-grid-swatch']:not([id$='KINDLE']) > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span",
        points: [
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span',
            '#tmm-grid-swatch-OTHER > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span',
            '#Ebooks-desktop-KINDLE_ALC-prices-loyaltyPoints',
            '#Ebooks-mobile-KINDLE_ALC-prices-loyaltyPoints'
        ].join(', ')
    };

    const COMMON_PATTERNS = {
        POINTS: /([\d,]+)\s*(?:pt|ポイント)/i,
        PRICE: /([\d,]+)/,
        PURCHASE_PRICE: [
            /(?:または[、,\s]*|購入価格[：:\s]*)[￥¥]\s*([\d,]+)(?:\s*で購入)?/,
            /[￥¥]\s*([\d,]+)\s*で購入/
        ]
    };

    const COMMON_CONFIG = {
        AUTHORS_URL:
            'https://kindle-asins.s3.ap-northeast-1.amazonaws.com/authors.json',
        EXCLUDED_KEYWORDS_URL:
            'https://kindle-asins.s3.ap-northeast-1.amazonaws.com/excluded_title_keywords.json',
        PAPER_BOOKS_URL:
            'https://kindle-asins.s3.ap-northeast-1.amazonaws.com/paper_books_asins.json',
        UNPROCESSED_BOOKS_URL:
            'https://kindle-asins.s3.ap-northeast-1.amazonaws.com/unprocessed_asins.json',

        POINT_THRESHOLD: 170,
        POINTS_RATE_THRESHOLD: 20,
        AVERAGE_PRICE_THRESHOLD: 350,
        MIN_PRICE: 221,
        PAPER_BOOK_MAX_REASONABLE_PRICE: 1800,
        YOUNG_JUMP_MAX_REASONABLE_PRICE: 600,

        NEW_RELEASE_DAYS: 7,

        CONCURRENT_REQUESTS: 20,
        REQUEST_DELAY: 1000,

        AFFILIATE_PARAMS: '?tag=shinderuman03-22',
        BADGE_EXPIRATION: 5 * 60 * 1000,
        MARKED_ASINS_EXPIRATION: 30 * 24 * 60 * 60 * 1000
    };

    const fetchJsonFromS3 = (url, dataType) => {
        return new Promise((resolve, reject) => {
            const cacheBuster = `?t=${Date.now()}&r=${Math.random()}`;
            const urlWithCacheBuster = url + cacheBuster;
            GM_xmlhttpRequest({
                method: 'GET',
                url: urlWithCacheBuster,
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0'
                },
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            console.log(
                                `📥 S3データ取得成功: ${dataType} (${data.length || Object.keys(data).length}件)`
                            );
                            resolve(data);
                        } catch (error) {
                            reject(
                                new Error(
                                    `Failed to parse ${dataType} JSON: ${error.message}`
                                )
                            );
                        }
                    } else {
                        reject(
                            new Error(
                                `Failed to fetch ${dataType}: ${response.status}`
                            )
                        );
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    const fetchPageInfo = (url, extractorFunction, bookTitle = null) => {
        return new Promise((resolve, reject) => {
            const cleanUrl = url.split('?')[0]; // アフィリエイトパラメータを除去
            GM_xmlhttpRequest({
                method: 'GET',
                url: cleanUrl,
                onload: (response) => {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(
                            response.responseText,
                            'text/html'
                        );
                        const info = extractorFunction(doc, cleanUrl);
                        resolve(info);
                    } else {
                        const error = new Error(
                            `Failed to fetch page: ${response.status}`
                        );
                        error.status = response.status;
                        sendPageFetchErrorNotification(cleanUrl, bookTitle);
                        reject(error);
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    const sendNotification = (title, text, url, timeout = 0) => {
        GM_notification({
            title,
            text,
            image: 'https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp',
            timeout,
            onclick: () => {
                if (url) {
                    GM_openInTab(url, { active: true });
                }
            }
        });
    };

    const sendCompletionNotification = (
        scriptName,
        totalCount,
        resultCount
    ) => {
        sendNotification(
            `📚 ${scriptName}完了`,
            `${totalCount}件中 ${resultCount}件を発見`,
            null,
            5000
        );
    };

    const sendErrorNotification = (scriptName, errorMessage) => {
        sendNotification(
            '❌ エラー',
            `${scriptName}中にエラーが発生しました: ${errorMessage}`,
            null,
            5000
        );
    };

    const sendPageFetchErrorNotification = (url, title) => {
        const message = `${title}のページ取得に失敗しました`;
        sendNotification('⚠️ ページ取得エラー', message, url, 0);
    };

    const extractAsinFromUrl = (url) => {
        const match = url.match(/\/dp\/([A-Z0-9]{10})/);
        return match ? match[1] : null;
    };

    const getElementText = (element) => {
        return (element?.innerText || element?.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const parsePositiveInteger = (value) => {
        const parsedValue = Number.parseInt(
            String(value).replace(/,/g, ''),
            10
        );
        return Number.isFinite(parsedValue) && parsedValue > 0
            ? parsedValue
            : 0;
    };

    const getElementValue = (doc, selector, regex) => {
        const selectors = selector.split(',').map((item) => item.trim());
        for (const currentSelector of selectors) {
            const element = doc.querySelector(currentSelector);
            if (!element) {
                continue;
            }

            const match = getElementText(element).match(regex);
            const value = match ? parsePositiveInteger(match[1]) : 0;
            if (value > 0) {
                return value;
            }
        }

        return 0;
    };

    const extractKindlePurchasePrice = (text) => {
        for (const pattern of COMMON_PATTERNS.PURCHASE_PRICE) {
            const match = text.match(pattern);
            if (!match) {
                continue;
            }

            const price = parsePositiveInteger(match[1]);
            if (price > 0) {
                return price;
            }
        }

        return 0;
    };

    const getKindlePrice = (doc) => {
        // KINDLEスウォッチ単体の価格を取得（KU対象だと￥0になる）
        const kindleSwatchPrice = getElementValue(
            doc,
            COMMON_SELECTORS.kindlePriceInSwatch,
            COMMON_PATTERNS.PRICE
        );
        if (kindleSwatchPrice > 0) {
            return kindleSwatchPrice;
        }

        for (const selector of COMMON_SELECTORS.kindlePurchasePrice) {
            const element = doc.querySelector(selector);
            const purchasePrice = extractKindlePurchasePrice(
                getElementText(element)
            );
            if (purchasePrice > 0) {
                return purchasePrice;
            }
        }

        return getElementValue(
            doc,
            COMMON_SELECTORS.kindlePrice,
            COMMON_PATTERNS.PRICE
        );
    };

    const getKindlePoints = (doc) => {
        // 通常商品では旧スウォッチまたは現行ALC購入ボックスから取得
        const points = getElementValue(
            doc,
            COMMON_SELECTORS.points,
            COMMON_PATTERNS.POINTS
        );
        if (points > 0) {
            return points;
        }

        // KU対象商品では購入価格の補助文言内にポイントが含まれる
        for (const selector of COMMON_SELECTORS.kindlePurchasePrice) {
            const element = doc.querySelector(selector);
            const match = getElementText(element).match(COMMON_PATTERNS.POINTS);
            const purchasePoints = match ? parsePositiveInteger(match[1]) : 0;
            if (purchasePoints > 0) {
                return purchasePoints;
            }
        }

        return 0;
    };

    const getStorageItems = (storageKey) => {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch (error) {
            console.error('❌ localStorage読み込みエラー:', error);
            return [];
        }
    };

    const saveStorageItems = (storageKey, newItems) => {
        try {
            const items = getStorageItems(storageKey);
            items.push(...newItems);
            localStorage.setItem(storageKey, JSON.stringify(items));
            console.log(`💾 ${newItems.length}アイテムをまとめて保存`);
        } catch (error) {
            console.error('❌ localStorage一括保存エラー:', error);
        }
    };

    const isAlreadyStored = (storageKey, checkFunction) => {
        const items = getStorageItems(storageKey);
        return items.some(checkFunction);
    };

    const cleanupOldStorageItems = (
        storageKey,
        cutoffDate,
        dateField = 'releaseDate'
    ) => {
        try {
            const items = getStorageItems(storageKey);
            const validItems = items.filter((item) => {
                const itemDate = new Date(item[dateField]);
                return itemDate >= cutoffDate;
            });
            const removedCount = items.length - validItems.length;
            if (removedCount > 0) {
                localStorage.setItem(storageKey, JSON.stringify(validItems));
                console.log(`🧹 古い記録を${removedCount}件削除しました`);
            }
        } catch (error) {
            console.error('❌ localStorage清理エラー:', error);
        }
    };

    const extractAmazonProductInfo = (doc, logContext = '') => {
        const title = getElementText(doc.querySelector(COMMON_SELECTORS.title));
        const points = getKindlePoints(doc);
        const kindlePrice = getKindlePrice(doc);
        const paperPrice = getElementValue(
            doc,
            COMMON_SELECTORS.paperPrice,
            COMMON_PATTERNS.PRICE
        );
        const couponBadge = doc.querySelector(COMMON_SELECTORS.couponBadge);
        const hasCoupon =
            couponBadge?.textContent?.includes('クーポン:') || false;

        if (points === 0) {
            console.warn(
                `⚠️ ポイント情報を取得できませんでした - ${title} ${logContext}`
            );
            console.warn('セレクタ:', COMMON_SELECTORS.points);
        }
        if (kindlePrice === 0) {
            console.warn(
                `⚠️ Kindle価格情報を取得できませんでした - ${title} ${logContext}`
            );
            console.warn('セレクタ:', COMMON_SELECTORS.kindlePrice);
        }
        if (paperPrice === 0) {
            console.log(
                `📖 紙書籍価格情報を取得できませんでした - ${title} ${logContext}`
            );
            console.log('セレクタ:', COMMON_SELECTORS.paperPrice);
        }

        return {
            title,
            asin: extractAsinFromUrl(
                doc.location?.href || window.location.href
            ),
            points,
            kindlePrice,
            paperPrice,
            hasCoupon
        };
    };

    const evaluateSaleConditions = (productInfo) => {
        const { points, kindlePrice, paperPrice, hasCoupon, title } =
            productInfo;
        const conditions = [];
        if (hasCoupon) {
            conditions.push(`✅クーポンあり`);
        }
        if (points >= COMMON_CONFIG.POINT_THRESHOLD) {
            conditions.push(`✅ポイント ${points}pt`);
        }
        if (
            kindlePrice &&
            (points / kindlePrice) * 100 >= COMMON_CONFIG.POINTS_RATE_THRESHOLD
        ) {
            conditions.push(
                `✅ポイント還元 ${((points / kindlePrice) * 100).toFixed(2)}%`
            );
        }
        if (shouldAddPriceDifference(paperPrice, kindlePrice, title)) {
            conditions.push(`✅価格差 ${paperPrice - kindlePrice}円`);
        }
        return conditions.length > 0 ? conditions.join(' ') : null;
    };

    const shouldAddPriceDifference = (paperPrice, kindlePrice, title) => {
        if (!paperPrice) {
            return false;
        }
        if (!isValidYoungJumpPrice(title, paperPrice)) {
            console.warn(
                `⚠️ ヤングジャンプ価格が高すぎます (${paperPrice}円)。定価ではないと思われるため価格差比較を除外します。`
            );
            return false;
        }
        if (paperPrice >= COMMON_CONFIG.PAPER_BOOK_MAX_REASONABLE_PRICE) {
            console.warn(
                `⚠️ 紙書籍価格が高すぎます (${paperPrice}円)。定価ではないと思われるため価格差比較を除外します。`
            );
            return false;
        }
        if (kindlePrice <= 0) {
            return false;
        }
        if (paperPrice - kindlePrice < COMMON_CONFIG.POINT_THRESHOLD) {
            return false;
        }
        return true;
    };

    const isValidYoungJumpPrice = (title, paperPrice) => {
        if (!title.includes('ヤングジャンプ')) {
            return true;
        }
        if (!/\d{4} No\./.test(title)) {
            return true;
        }
        if (paperPrice < COMMON_CONFIG.YOUNG_JUMP_MAX_REASONABLE_PRICE) {
            return true;
        }
        return false;
    };

    return {
        COMMON_CONFIG,
        COMMON_SELECTORS,
        COMMON_PATTERNS,
        fetchJsonFromS3,
        fetchPageInfo,
        sendNotification,
        sendCompletionNotification,
        sendErrorNotification,
        sendPageFetchErrorNotification,
        extractAsinFromUrl,
        getElementValue,
        getStorageItems,
        saveStorageItems,
        isAlreadyStored,
        cleanupOldStorageItems,
        extractAmazonProductInfo,
        evaluateSaleConditions
    };
})();
