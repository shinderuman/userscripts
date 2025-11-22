// 共通ライブラリ
unsafeWindow.KindleCommon = (function () {
    'use strict';

    // 共通セレクタ
    const COMMON_SELECTORS = {
        title: '#productTitle',
        kindleBookAvailable: '#tmm-grid-swatch-KINDLE',
        paperBookAvailable: '[id^=\'tmm-grid-swatch\']:not([id$=\'KINDLE\'])',
        couponBadge: 'i.a-icon.a-icon-addon.newCouponBadge',
        kindlePrice: [
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
            '#tmm-grid-swatch-OTHER > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
            '#kindle-price',
            '#a-autoid-2-announce > span.slot-price > span',
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-extraMessage .kindleExtraMessage .a-color-price'
        ].join(', '),
        paperPrice: '[id^=\'tmm-grid-swatch\']:not([id$=\'KINDLE\']) > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
        points: '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span, #tmm-grid-swatch-OTHER > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span'
    };

    // 共通正規表現
    const COMMON_PATTERNS = {
        POINTS: /(\d+)pt/,
        PRICE: /([\d,]+)/
    };

    // 共通設定
    const COMMON_CONFIG = {
        // S3 URLs
        AUTHORS_URL: 'https://kindle-asins.s3.ap-northeast-1.amazonaws.com/authors.json',
        EXCLUDED_KEYWORDS_URL: 'https://kindle-asins.s3.ap-northeast-1.amazonaws.com/excluded_title_keywords.json',
        PAPER_BOOKS_URL: 'https://kindle-asins.s3.ap-northeast-1.amazonaws.com/paper_books_asins.json',
        UNPROCESSED_BOOKS_URL: 'https://kindle-asins.s3.ap-northeast-1.amazonaws.com/unprocessed_asins.json',

        // 共通閾値
        POINT_THRESHOLD: 151,
        POINTS_RATE_THRESHOLD: 20,
        AVERAGE_PRICE_THRESHOLD: 350,
        MIN_PRICE: 221,

        // 新刊チェック設定
        NEW_RELEASE_DAYS: 7,

        // リクエスト制御
        CONCURRENT_REQUESTS: 20,
        REQUEST_DELAY: 1000,

        // その他
        AFFILIATE_PARAMS: '?tag=shinderuman03-22&linkCode=ogi&th=1&psc=1',
        BADGE_EXPIRATION: 5 * 60 * 1000,
        MARKED_ASINS_EXPIRATION: 30 * 24 * 60 * 60 * 1000
    };

    // S3からJSONデータを取得する共通関数
    const fetchJsonFromS3 = (url, dataType) => {
        return new Promise((resolve, reject) => {
            // キャッシュバスターを追加してキャッシュを無効化
            const cacheBuster = `?t=${Date.now()}&r=${Math.random()}`;
            const urlWithCacheBuster = url + cacheBuster;

            GM_xmlhttpRequest({
                method: 'GET',
                url: urlWithCacheBuster,
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            console.log(`📥 S3データ取得成功: ${dataType} (${data.length || Object.keys(data).length}件)`);
                            resolve(data);
                        } catch (error) {
                            reject(new Error(`Failed to parse ${dataType} JSON: ${error.message}`));
                        }
                    } else {
                        reject(new Error(`Failed to fetch ${dataType}: ${response.status}`));
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    // 個別ページの情報を取得する共通関数
    const fetchPageInfo = (url, extractorFunction) => {
        return new Promise((resolve, reject) => {
            const cleanUrl = url.split('?')[0]; // アフィリエイトパラメータを除去

            GM_xmlhttpRequest({
                method: 'GET',
                url: cleanUrl,
                onload: (response) => {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const info = extractorFunction(doc, cleanUrl);
                        resolve(info);
                    } else {
                        reject(new Error(`Failed to fetch page: ${response.status}`));
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    // バッチ処理の共通関数
    const processBatch = async (items, processorFunction, config) => {
        const { CONCURRENT_REQUESTS = 20, REQUEST_DELAY = 1000 } = config;

        console.log(`📚 ${items.length}件の処理を開始...`);

        let processedCount = 0;
        let resultCount = 0;

        for (let i = 0; i < items.length; i += CONCURRENT_REQUESTS) {
            const batch = items.slice(i, i + CONCURRENT_REQUESTS);

            const promises = batch.map(async (item) => {
                try {
                    const result = await processorFunction(item);
                    processedCount++;

                    if (result.success && result.shouldNotify) {
                        resultCount++;
                    }

                    return result;
                } catch (error) {
                    console.error(`❌ エラー: ${item.URL || item.Name || 'Unknown'}`, error);
                    return { success: false, error };
                }
            });

            await Promise.all(promises);

            // 次のバッチまで待機（レート制限対策）
            if (i + CONCURRENT_REQUESTS < items.length) {
                await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
            }
        }

        return { processedCount, resultCount };
    };

    // 通知送信の共通関数
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

    // 完了通知の共通関数
    const sendCompletionNotification = (scriptName, totalCount, resultCount) => {
        sendNotification(
            `📚 ${scriptName}完了`,
            `${totalCount}件中 ${resultCount}件を発見`,
            null,
            5000
        );
    };

    // エラー通知の共通関数
    const sendErrorNotification = (scriptName, errorMessage) => {
        sendNotification(
            '❌ エラー',
            `${scriptName}中にエラーが発生しました: ${errorMessage}`,
            null,
            5000
        );
    };

    // URLからASINを抽出
    const extractAsinFromUrl = (url) => {
        const match = url.match(/\/dp\/([A-Z0-9]{10})/);
        return match ? match[1] : null;
    };

    // 共通のDOM要素値取得関数
    const getElementValue = (doc, selector, regex) => {
        // 複数のセレクターがカンマ区切りで渡された場合、順番に試す
        const selectors = selector.split(',').map(s => s.trim());

        for (const sel of selectors) {
            const element = doc.querySelector(sel);
            if (element) {
                const match = element.innerText.match(regex);
                const value = match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
                if (value > 0) {
                    return value;
                }
            }
        }

        return 0;
    };

    // localStorage管理機能
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

    const cleanupOldStorageItems = (storageKey, cutoffDate, dateField = 'releaseDate') => {
        try {
            const items = getStorageItems(storageKey);
            const validItems = items.filter(item => {
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

      // Amazon商品情報抽出
    const extractAmazonProductInfo = (doc, logContext = '') => {
        const title = doc.querySelector(COMMON_SELECTORS.title)?.innerText.trim();
        const points = getElementValue(doc, COMMON_SELECTORS.points, COMMON_PATTERNS.POINTS);
        const kindlePrice = getElementValue(doc, COMMON_SELECTORS.kindlePrice, COMMON_PATTERNS.PRICE);
        const paperPrice = getElementValue(doc, COMMON_SELECTORS.paperPrice, COMMON_PATTERNS.PRICE);
        const couponBadge = doc.querySelector(COMMON_SELECTORS.couponBadge);
        const hasCoupon = couponBadge?.textContent?.includes('クーポン:') || false;

        // 取得できなかった値についてログを出力
        if (points === 0) {
            console.warn(`⚠️ ポイント情報を取得できませんでした - ${title} ${logContext}`);
            console.warn('セレクタ:', COMMON_SELECTORS.points);
        }
        if (kindlePrice === 0) {
            console.warn(`⚠️ Kindle価格情報を取得できませんでした - ${title} ${logContext}`);
            console.warn('セレクタ:', COMMON_SELECTORS.kindlePrice);
        }
        if (paperPrice === 0) {
            console.log(`📖 紙書籍価格情報を取得できませんでした - ${title} ${logContext}`);
            console.log('セレクタ:', COMMON_SELECTORS.paperPrice);
        }

        return {
            title,
            asin: extractAsinFromUrl(doc.location?.href || window.location.href),
            points,
            kindlePrice,
            paperPrice,
            hasCoupon
        };
    };

    // セール条件評価
    const evaluateSaleConditions = (productInfo, config = COMMON_CONFIG) => {
        const { points, kindlePrice, paperPrice, hasCoupon } = productInfo;
        const conditions = [];

        if (hasCoupon) {
            conditions.push(`✅クーポンあり`);
        }
        if (points >= config.POINT_THRESHOLD) {
            conditions.push(`✅ポイント ${points}pt`);
        }
        if (kindlePrice && (points / kindlePrice) * 100 >= config.POINTS_RATE_THRESHOLD) {
            conditions.push(`✅ポイント還元 ${(points / kindlePrice * 100).toFixed(2)}%`);
        }
        if (paperPrice && kindlePrice > 0 && paperPrice - kindlePrice >= config.POINT_THRESHOLD) {
            conditions.push(`✅価格差 ${paperPrice - kindlePrice}円`);
        }

        return conditions.length > 0 ? conditions.join(' ') : null;
    };

    // 公開API
    return {
        COMMON_CONFIG,
        COMMON_SELECTORS,
        COMMON_PATTERNS,
        fetchJsonFromS3,
        fetchPageInfo,
        processBatch,
        sendNotification,
        sendCompletionNotification,
        sendErrorNotification,
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
