unsafeWindow.KindleCommon = (function () {
    'use strict';

    const COMMON_SELECTORS = {
        title: '#productTitle',
        formatSwatches: [
            '#inline-twister-expander-content-media_format li[data-asin]',
            '#inline-twister-singleton-header-media_format',
            '#tmmSwatches .swatchElement',
            '#mediaMatrixGridAODPopoverEntries .mm-grid-aod-popover-format-entry'
        ].join(', '),
        formatTitle:
            '.swatch-title-text, #inline-twister-expanded-dimension-text-media_format, .slot-title',
        formatPrice: '.apex-pricetopay-accessibility-label',
        paperPrice:
            '#corePriceDisplay_desktop_feature_div #apex-pricetopay-accessibility-label',
        couponBadge: 'i.a-icon.a-icon-addon.newCouponBadge',
        kindlePrice: '#combinedBuyBox .apex-pricetopay-accessibility-label',
        points: '#Ebooks-desktop-KINDLE_ALC-prices #aip-buybox-display-text'
    };

    const SERIES_SELECTORS = {
        offerButtons: 'button[id^="offer-tab-button_offer_"]',
        offerButtonTotal: 'div > span',
        offerButtonPrice: 'div > div > span',
        offerBuyBox: '[data-offer-id="offer_{OFFER_NUMBER}"] #buy-box',
        buyBoxPoints:
            'div.a-row.a-spacing-mini > div.a-column.a-span7.a-text-right.a-span-last > span',
        accordionRow: '[data-a-accordion-row-name], [data-accordion-id]',
        accordionHeader: '.a-heading-text, h3'
    };

    const SERIES_PATTERNS = {
        offerButtonId: /offer-tab-button_offer_(\d+)/,
        totalBooks: [
            /購入可能な全\s*(\d+)\s*冊/,
            /残りの全\s*(\d+)\s*冊/,
            /次の(\d+)冊/,
            /(\d+)冊すべて/
        ],
        seriesPrice: /(\d+(?:,\d+)*)/,
        seriesPoints: /(\d+(?:,\d+)*)\s*pt/
    };

    const COMMON_PATTERNS = {
        POINTS: /([\d,]+)\s*(?:pt|ポイント)/i,
        PRICE: /[￥¥]\s*([\d,]+)/
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

        POINT_THRESHOLD: 171,
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

    const TOAST_BACKGROUNDS = {
        info: '#0F1111',
        success: '#067D62',
        error: '#CC0C39'
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

    const fetchDocument = (url, bookTitle = null) => {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(
                                response.responseText,
                                'text/html'
                            );
                            resolve(doc);
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        const error = new Error(
                            `Failed to fetch page: ${response.status}`
                        );
                        error.status = response.status;
                        sendPageFetchErrorNotification(url, bookTitle);
                        reject(error);
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    const fetchPageInfo = async (url, extractorFunction, bookTitle = null) => {
        const cleanUrl = url.split('?')[0];
        const doc = await fetchDocument(cleanUrl, bookTitle);
        return extractorFunction(doc, cleanUrl);
    };

    const createRequestLimiter = (limit) => {
        let activeCount = 0;
        const waiting = [];
        return async (request) => {
            if (activeCount >= limit) {
                await new Promise((resolve) => waiting.push(resolve));
            } else {
                activeCount++;
            }
            try {
                return await request();
            } finally {
                const next = waiting.shift();
                if (next) next();
                else activeCount--;
            }
        };
    };

    const processBatch = async (items, processor, config = COMMON_CONFIG) => {
        const results = [];
        for (let i = 0; i < items.length; i += config.CONCURRENT_REQUESTS) {
            const batch = items.slice(i, i + config.CONCURRENT_REQUESTS);
            results.push(...(await Promise.all(batch.map(processor))));
            if (i + config.CONCURRENT_REQUESTS < items.length) {
                await new Promise((resolve) =>
                    setTimeout(resolve, config.REQUEST_DELAY)
                );
            }
        }
        return results;
    };

    const isBadgeExpired = (
        timestamp,
        expiration = COMMON_CONFIG.BADGE_EXPIRATION,
        now = Date.now()
    ) => {
        if (!timestamp) return false;
        return now - Number(timestamp) >= expiration;
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

    const showToast = (message, type = 'info', duration = 3000) => {
        let container = document.getElementById(
            'kindle-common-toast-container'
        );

        if (!container) {
            container = document.createElement('div');
            container.id = 'kindle-common-toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 8px;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            padding: 10px 16px;
            background: ${TOAST_BACKGROUNDS[type] ?? TOAST_BACKGROUNDS.info};
            color: #FFFFFF;
            border-radius: 8px;
            font-size: 13px;
            font-family: "Amazon Ember", Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            opacity: 0;
            transition: opacity 0.3s;
        `;
        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });

        let hideTimer = null;

        const hideToast = () => {
            clearTimeout(hideTimer);
            toast.remove();
            if (!container.hasChildNodes()) {
                container.remove();
            }
        };

        if (duration > 0) {
            hideTimer = setTimeout(hideToast, duration);
        }

        return {
            update: (nextMessage) => {
                toast.textContent = nextMessage;
            },
            hide: hideToast
        };
    };

    const extractAsinFromUrl = (url) => {
        const match = url.match(
            /\/(?:dp|gp\/product|kindle-dbs\/product)\/([A-Z0-9]{10})[/?]?/
        );
        return match ? match[1] : null;
    };

    const getElementText = (element) => {
        return (element?.textContent || '').replace(/\s+/g, ' ').trim();
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
        const match = getElementText(doc.querySelector(selector)).match(regex);
        return match ? parsePositiveInteger(match[1]) : 0;
    };

    const extractBookFormats = (doc) => {
        const formats = { kindle: null, paper: null };
        for (const swatch of doc.querySelectorAll(
            COMMON_SELECTORS.formatSwatches
        )) {
            if (swatch.getAttribute('data-initiallyunavailable') === 'true')
                continue;
            const isMediaMatrixEntry = swatch.classList.contains(
                'mm-grid-aod-popover-format-entry'
            );
            const label = isMediaMatrixEntry
                ? (swatch.firstChild?.textContent || '').trim()
                : getElementText(
                      swatch.querySelector(COMMON_SELECTORS.formatTitle)
                  );
            const priceText = getElementText(
                swatch.querySelector(COMMON_SELECTORS.formatPrice)
            );
            const priceMatch = priceText.match(COMMON_PATTERNS.PRICE);
            const format = {
                label,
                asin: getFormatAsin(doc, swatch),
                price: priceMatch
                    ? Number(priceMatch[1].replace(/,/g, ''))
                    : null
            };
            if (label === 'Kindle版 (電子書籍)') formats.kindle = format;
            else if (
                label.endsWith('(紙)') ||
                label === '雑誌' ||
                label === '単行本'
            )
                formats.paper = format;
        }
        return formats;
    };

    const getFormatAsin = (doc, swatch) => {
        if (swatch.classList.contains('mm-grid-aod-popover-format-entry')) {
            return JSON.parse(
                swatch.parentElement.getAttribute(
                    'data-show-all-offers-display'
                )
            ).asin;
        }
        if (swatch.hasAttribute('data-asin'))
            return swatch.getAttribute('data-asin');
        const link = swatch.querySelector('a.a-button-text');
        if (
            swatch.id === 'inline-twister-singleton-header-media_format' ||
            link?.getAttribute('aria-checked') === 'true'
        ) {
            return doc.querySelector('#ASIN')?.value;
        }
        return extractAsinFromUrl(link?.getAttribute('href') || '');
    };

    const getBookAvailability = (doc) => {
        const formats = extractBookFormats(doc);
        return {
            paperBookAvailable: !!formats.paper,
            kindleBookAvailable: !!formats.kindle
        };
    };

    const parseDateFromText = (text) => {
        if (!text) return null;
        const match = text.match(
            /(\d{4})年(\d{1,2})月(\d{1,2})日|(\d{4})\/(\d{1,2})\/(\d{1,2})/
        );
        return match
            ? new Date(
                  match[1] || match[4],
                  (match[2] || match[5]) - 1,
                  match[3] || match[6]
              )
            : null;
    };

    const extractReleaseDate = (doc) => {
        const row = Array.from(
            doc.querySelectorAll('#detailBullets_feature_div li')
        ).find((element) =>
            getElementText(element.querySelector('.a-text-bold')).startsWith(
                '発売日'
            )
        );
        return parseDateFromText(getElementText(row));
    };

    const extractAmazonSearchBooks = (doc) => {
        return Array.from(
            doc.querySelectorAll('[data-component-type="s-search-result"]')
        )
            .slice(0, 10)
            .map((item) => {
                const titleBlock = item.querySelector(
                    '[data-cy="title-recipe"]'
                );
                const title = getElementText(titleBlock?.querySelector('h2'));
                const href = titleBlock
                    ?.querySelector('h2')
                    ?.closest('a')
                    ?.getAttribute('href');
                const url = href
                    ? new URL(href, 'https://www.amazon.co.jp').href
                    : '';
                const priceText = item
                    .querySelector(
                        '[data-csa-c-buying-option-type="KINDLE_ALC"][data-csa-c-price-to-pay]'
                    )
                    ?.getAttribute('data-csa-c-price-to-pay');
                const price = priceText?.trim() ? Number(priceText) : NaN;
                return {
                    title,
                    url,
                    asin: extractAsinFromUrl(url),
                    releaseDate: parseDateFromText(
                        getElementText(
                            titleBlock?.querySelector(
                                '.a-size-base.a-color-secondary.a-text-normal'
                            )
                        )
                    ),
                    kindlePrice:
                        Number.isFinite(price) && price >= 0 ? price : null,
                    authors: Array.from(
                        titleBlock?.querySelectorAll('.a-row .a-size-base') ||
                            []
                    ).map(getElementText)
                };
            });
    };

    const selectNewReleaseCandidates = (
        books,
        { authorName, excludedKeywords, excludedAsins, isbnMode }
    ) => {
        return books.filter((book) => {
            if (!book.title || !book.url || !book.asin) return false;
            const isISBN =
                book.asin.length >= 10 &&
                book.asin.length <= 13 &&
                /^\d+$/.test(book.asin);
            if (isbnMode === 1 ? !isISBN : isbnMode !== 2 && isISBN)
                return false;
            return (
                !excludedAsins.has(book.asin) &&
                !excludedKeywords.some((keyword) =>
                    book.title.includes(keyword)
                ) &&
                book.authors.some((author) => author.includes(authorName))
            );
        });
    };

    const isNewRelease = (
        productInfo,
        cutoffDate,
        minPrice = COMMON_CONFIG.MIN_PRICE
    ) => {
        return (
            productInfo.releaseDate > cutoffDate &&
            (productInfo.kindlePrice === null ||
                productInfo.kindlePrice > minPrice)
        );
    };

    const getStorageItems = (storageKey) => {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch (error) {
            console.error('❌ localStorage読み込みエラー:', error);
            return [];
        }
    };

    const openNewReleaseCheckStore = () =>
        new Promise((resolve, reject) => {
            const request = indexedDB.open('KindleNewReleaseChecker', 2);
            request.onupgradeneeded = (event) => {
                if (event.oldVersion === 0) {
                    request.result.createObjectStore('checkedAsins');
                } else {
                    // v1の確認時刻を削除し、チェック済みASINは引き継ぐ。
                    const cursorRequest = request.transaction
                        .objectStore('checkedAsins')
                        .openCursor();
                    cursorRequest.onsuccess = () => {
                        const cursor = cursorRequest.result;
                        if (cursor) {
                            cursor.update(null);
                            cursor.continue();
                        }
                    };
                }
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transact = (mode, operation) =>
                    new Promise((resolveTransaction, rejectTransaction) => {
                        const transaction = db.transaction(
                            'checkedAsins',
                            mode
                        );
                        let result;
                        transaction.oncomplete = () =>
                            resolveTransaction(result?.result);
                        transaction.onabort = () =>
                            rejectTransaction(transaction.error);
                        try {
                            result = operation(
                                transaction.objectStore('checkedAsins')
                            );
                        } catch (error) {
                            transaction.abort();
                            rejectTransaction(error);
                        }
                    });
                resolve({
                    getCheckedAsins: () =>
                        transact('readonly', (store) => store.getAllKeys()),
                    markCheckedAsins: (asins) =>
                        transact('readwrite', (store) => {
                            for (const asin of asins) store.put(null, asin);
                        }),
                    close: () => db.close()
                });
            };
        });

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

    const extractAmazonProductInfo = (doc, url = '') => {
        const title = getElementText(doc.querySelector(COMMON_SELECTORS.title));
        const points = getElementValue(
            doc,
            COMMON_SELECTORS.points,
            COMMON_PATTERNS.POINTS
        );
        const formats = extractBookFormats(doc);
        const asin = extractAsinFromUrl(url);
        const paperAsin = formats.paper?.asin || null;
        const kindlePrice =
            paperAsin && paperAsin === asin
                ? formats.kindle?.price || 0
                : getElementValue(
                      doc,
                      COMMON_SELECTORS.kindlePrice,
                      COMMON_PATTERNS.PRICE
                  );
        const paperPrice =
            paperAsin === asin && paperAsin
                ? getElementValue(
                      doc,
                      COMMON_SELECTORS.paperPrice,
                      COMMON_PATTERNS.PRICE
                  )
                : formats.paper?.price || 0;
        const couponBadge = doc.querySelector(COMMON_SELECTORS.couponBadge);
        return {
            title,
            asin,
            points,
            kindlePrice,
            kindleAsin: formats.kindle?.asin || null,
            paperAsin,
            paperPrice,
            paperBookAvailable: !!formats.paper,
            kindleBookAvailable: !!formats.kindle,
            releaseDate: extractReleaseDate(doc),
            hasCoupon: couponBadge?.textContent?.includes('クーポン:') || false,
            couponText:
                doc
                    .querySelector('.couponLabelText')
                    ?.firstChild?.textContent?.trim() || ''
        };
    };

    const fetchKindleInfoForPaper = async (productInfo) => {
        if (
            !productInfo.kindleAsin ||
            productInfo.paperAsin !== productInfo.asin
        )
            return productInfo;
        // 紙ページのKindle形式欄には価格のみがあり、Kindleの獲得ポイントはない。
        const { points, kindlePrice, hasCoupon, couponText } =
            await fetchPageInfo(
                `https://www.amazon.co.jp/dp/${productInfo.kindleAsin}`,
                extractAmazonProductInfo,
                productInfo.title
            );
        return { ...productInfo, points, kindlePrice, hasCoupon, couponText };
    };

    const fetchAmazonProductInfo = async (doc, url, logContext = '') => {
        const productInfo = await fetchKindleInfoForPaper(
            extractAmazonProductInfo(doc, url)
        );
        const { title, points, kindlePrice, paperAsin, paperBookAvailable } =
            productInfo;
        // 形式欄の価格はJavaScriptで後から挿入され、取得HTMLには含まれない。
        const paperPrice =
            !paperAsin ||
            productInfo.paperPrice > 0 ||
            paperAsin === productInfo.asin
                ? productInfo.paperPrice
                : await fetchPageInfo(
                      `https://www.amazon.co.jp/dp/${paperAsin}`,
                      (paperDoc) =>
                          getElementValue(
                              paperDoc,
                              COMMON_SELECTORS.paperPrice,
                              COMMON_PATTERNS.PRICE
                          ),
                      title
                  );
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
        if (paperBookAvailable && paperPrice === 0) {
            console.log(
                `📖 紙書籍価格情報を取得できませんでした - ${title} ${logContext}`
            );
            console.log('セレクタ:', COMMON_SELECTORS.paperPrice);
        }

        return {
            ...productInfo,
            paperPrice
        };
    };

    const waitForRenderedProductInfo = (doc, url) => {
        const read = () => {
            if (doc.readyState === 'loading') return null;
            if (
                doc.querySelector(
                    '#inline-twister-expander-content-media_format li[data-asin]:not([data-initiallyunavailable="true"]) .loading-indicator-2'
                )
            )
                return null;
            return extractAmazonProductInfo(doc, url);
        };
        const ready = read();
        if (ready) return Promise.resolve(ready);
        return new Promise((resolve) => {
            const cleanup = () => {
                observer.disconnect();
                doc.removeEventListener('readystatechange', check);
            };
            const check = () => {
                const info = read();
                if (info) {
                    cleanup();
                    resolve(info);
                }
            };
            const observer = new MutationObserver(check);
            doc.addEventListener('readystatechange', check);
            observer.observe(doc.documentElement, {
                childList: true,
                subtree: true,
                characterData: true
            });
            check();
        });
    };

    const extractAmazonSeriesInfo = (doc) => {
        const getMaxOfferButton = () => {
            const offerButtons = doc.querySelectorAll(
                SERIES_SELECTORS.offerButtons
            );
            let maxOfferButton = null;
            let maxOfferNumber = -1;

            offerButtons.forEach((button) => {
                const accordionRow = button.closest(
                    SERIES_SELECTORS.accordionRow
                );
                if (accordionRow) {
                    const headerText = accordionRow.querySelector(
                        SERIES_SELECTORS.accordionHeader
                    );
                    if (
                        headerText &&
                        headerText.textContent.includes('まとめ買い (話)')
                    ) {
                        return;
                    }
                }

                const match = button.id.match(SERIES_PATTERNS.offerButtonId);
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
            const totalSpan = button.querySelector(
                SERIES_SELECTORS.offerButtonTotal
            );
            if (!totalSpan) return 0;

            const totalText = totalSpan.textContent;

            for (const pattern of SERIES_PATTERNS.totalBooks) {
                const match = totalText.match(pattern);
                if (match) {
                    return parseInt(match[1]);
                }
            }
            return 0;
        };

        const getSeriesPriceFromButton = (button) => {
            const priceSpan = button.querySelector(
                SERIES_SELECTORS.offerButtonPrice
            );
            if (!priceSpan) return 0;

            const priceText = priceSpan.textContent;
            const priceMatch = priceText.match(SERIES_PATTERNS.seriesPrice);
            if (priceMatch) {
                return parseInt(priceMatch[1].replace(/,/g, ''));
            }
            return 0;
        };

        const getSeriesPoints = (button) => {
            const match = button.id.match(SERIES_PATTERNS.offerButtonId);
            if (!match) return 0;

            const buyBoxSelector = SERIES_SELECTORS.offerBuyBox.replace(
                '{OFFER_NUMBER}',
                match[1]
            );
            const buyBox = doc.querySelector(buyBoxSelector);
            if (!buyBox) return 0;

            const pointsElement = buyBox.querySelector(
                SERIES_SELECTORS.buyBoxPoints
            );
            if (pointsElement) {
                const pointsText = pointsElement.textContent;
                const pointsMatch = pointsText.match(
                    SERIES_PATTERNS.seriesPoints
                );
                if (pointsMatch) {
                    return parseInt(pointsMatch[1].replace(/,/g, ''));
                }
            }
            return 0;
        };

        const getSeriesCouponInfo = (maxOfferButton) => {
            if (!maxOfferButton) {
                return { hasSeriesCoupon: false, seriesCouponText: '' };
            }

            const match = maxOfferButton.id.match(
                SERIES_PATTERNS.offerButtonId
            );
            if (!match) {
                return { hasSeriesCoupon: false, seriesCouponText: '' };
            }

            const offerNumber = match[1];

            const buyBoxSelector = SERIES_SELECTORS.offerBuyBox.replace(
                '{OFFER_NUMBER}',
                offerNumber
            );
            const buyBox = doc.querySelector(buyBoxSelector);

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

        const button = getMaxOfferButton();
        if (!button) return null;
        const bookCount = getSeriesTotalFromButton(button);
        if (bookCount === 0) return null;
        return {
            bookCount,
            seriesPrice: getSeriesPriceFromButton(button),
            seriesPoints: getSeriesPoints(button),
            ...getSeriesCouponInfo(button)
        };
    };

    const evaluateSeriesSaleConditions = (info, config = COMMON_CONFIG) => {
        const {
            bookCount,
            seriesPrice,
            seriesPoints,
            hasSeriesCoupon,
            seriesCouponText
        } = info;
        if (bookCount === 0) return null;
        const conditions = [];
        if (hasSeriesCoupon)
            conditions.push(`✅シリーズクーポンあり (${seriesCouponText})`);
        if (seriesPoints >= config.POINT_THRESHOLD)
            conditions.push(`✅シリーズのポイントが ${seriesPoints}pt です。`);
        if (
            bookCount > 0 &&
            seriesPrice > 0 &&
            seriesPrice / bookCount <= config.AVERAGE_PRICE_THRESHOLD
        ) {
            conditions.push(
                `${bookCount}冊が平均 ${(seriesPrice / bookCount).toFixed(2)}円 で購入可能です。`
            );
        }
        return conditions.length > 0 ? conditions.join(' ') : null;
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
        fetchDocument,
        fetchPageInfo,
        createRequestLimiter,
        processBatch,
        isBadgeExpired,
        sendNotification,
        sendCompletionNotification,
        sendErrorNotification,
        sendPageFetchErrorNotification,
        showToast,
        extractAsinFromUrl,
        getElementText,
        extractBookFormats,
        getBookAvailability,
        parseDateFromText,
        extractReleaseDate,
        extractAmazonSearchBooks,
        selectNewReleaseCandidates,
        isNewRelease,
        getElementValue,
        getStorageItems,
        openNewReleaseCheckStore,
        saveStorageItems,
        isAlreadyStored,
        cleanupOldStorageItems,
        extractAmazonProductInfo,
        fetchAmazonProductInfo,
        fetchKindleInfoForPaper,
        waitForRenderedProductInfo,
        evaluateSeriesSaleConditions,
        extractAmazonSeriesInfo,
        evaluateSaleConditions
    };
})();
