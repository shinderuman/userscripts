(function () {
    'use strict';

    const {
        COMMON_CONFIG,
        fetchJsonFromS3,
        sendErrorNotification,
        sendCompletionNotification,
        sendPageFetchErrorNotification,
        extractAsinFromUrl,
        saveStorageItems,
        isAlreadyStored,
        cleanupOldStorageItems
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        ...COMMON_CONFIG,
        LOCAL_STORAGE_KEYS: {
            NOTIFICATIONS: 'newReleaseNotifications'
        }
    };

    const isISBN = (asin) => {
        if (!asin) return false;

        const length = asin.length;
        return length >= 10 && length <= 13 && /^\d+$/.test(asin);
    };

    const checkNewReleases = async (isbnMode = 0) => {
        try {
            cleanupOldNotifications();

            console.log(
                `📖 ISBN処理モード: ${getISBNModeDescription(isbnMode)}`
            );

            const authors = await fetchAuthors();
            console.log(`${authors.length}人をチェックします`);

            const excludedKeywords = await fetchExcludedKeywords();

            await checkPagesInBatches(authors, excludedKeywords, isbnMode);
        } catch (error) {
            console.error('❌ エラーが発生しました:', error);
            sendErrorNotification('新刊チェック', error.message);
        }
    };

    const getISBNModeDescription = (mode) => {
        switch (mode) {
            case 0:
                return '0 (ISBNをスキップ)';
            case 1:
                return '1 (ISBNのみ表示)';
            case 2:
                return '2 (どちらも表示)';
            default:
                return `${mode} (不明なモード、ISBNをスキップとして処理)`;
        }
    };

    const cleanupOldNotifications = () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - CONFIG.NEW_RELEASE_DAYS);
        cleanupOldStorageItems(
            CONFIG.LOCAL_STORAGE_KEYS.NOTIFICATIONS,
            cutoffDate,
            'releaseDate'
        );
    };

    const fetchAuthors = () => {
        return fetchJsonFromS3(CONFIG.AUTHORS_URL, 'authors');
    };

    const fetchExcludedKeywords = () => {
        return fetchJsonFromS3(
            CONFIG.EXCLUDED_KEYWORDS_URL,
            'excluded keywords'
        );
    };

    const checkPagesInBatches = async (authors, excludedKeywords, isbnMode) => {
        let newReleaseCount = 0;
        let processedCount = 0;
        const newReleaseBooks = [];

        for (let i = 0; i < authors.length; i += CONFIG.CONCURRENT_REQUESTS) {
            const batch = authors.slice(i, i + CONFIG.CONCURRENT_REQUESTS);

            const promises = batch.map(async (authorInfo) => {
                try {
                    authorInfo.excludedKeywords = excludedKeywords;
                    authorInfo.isbnMode = isbnMode;
                    const pageInfo = await fetchAuthorSearchInfo(authorInfo);
                    const hasNewReleases = checkNewReleaseConditions(pageInfo);

                    processedCount++;
                    console.log(
                        `進捗: ${processedCount}/${authors.length} - ${pageInfo.Name}`
                    );

                    if (hasNewReleases) {
                        newReleaseCount += pageInfo.newReleases.length;
                        console.log(
                            `✅ 新刊発見: ${pageInfo.Name} - ${pageInfo.newReleases.length}冊`
                        );
                        pageInfo.newReleases.forEach((book) => {
                            newReleaseBooks.push(book);
                        });
                    }

                    return { success: true, info: pageInfo, hasNewReleases };
                } catch (error) {
                    console.error(`❌ エラー: ${authorInfo.Name}`, error);
                    return { success: false, error };
                }
            });

            await Promise.all(promises);

            // 次のバッチまで待機（レート制限対策）
            if (i + CONFIG.CONCURRENT_REQUESTS < authors.length) {
                await new Promise((resolve) =>
                    setTimeout(resolve, CONFIG.REQUEST_DELAY)
                );
            }
        }

        const now = new Date().toLocaleString('ja-JP');
        console.log(
            `🆗 チェック完了: ${newReleaseCount}冊の新刊を発見しました (${now})`
        );

        if (newReleaseBooks.length > 0) {
            newReleaseBooks.forEach((book) => {
                GM_openInTab(book.url, { active: false });
            });

            saveStorageItems(
                CONFIG.LOCAL_STORAGE_KEYS.NOTIFICATIONS,
                newReleaseBooks
            );
        }

        sendCompletionNotification(
            '新刊チェック',
            authors.length,
            newReleaseCount
        );
    };

    const fetchAuthorSearchInfo = async (authorInfo) => {
        return new Promise((resolve, reject) => {
            const searchUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(authorInfo.Name)}&i=digital-text&rh=n%3A2250738051&s=date-desc-rank`;

            console.log(`📄 検索URL: ${searchUrl}`);

            GM_xmlhttpRequest({
                method: 'GET',
                url: searchUrl,
                onload: async (response) => {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(
                            response.responseText,
                            'text/html'
                        );

                        const info = await extractSearchPageInfo(
                            doc,
                            authorInfo,
                            authorInfo.excludedKeywords
                        );
                        resolve(info);
                    } else {
                        console.error(
                            `❌ 検索ページ取得失敗: ${response.status}`
                        );
                        sendPageFetchErrorNotification(
                            searchUrl,
                            authorInfo.Name
                        );
                        reject(
                            new Error(
                                `Failed to fetch search page: ${response.status}`
                            )
                        );
                    }
                },
                onerror: (error) => {
                    console.error(`❌ 検索リクエストエラー: ${error}`);
                    reject(error);
                }
            });
        });
    };

    const extractSearchPageInfo = async (doc, authorInfo, excludedKeywords) => {
        const searchResults = doc.querySelectorAll(
            '[data-component-type="s-search-result"]'
        );
        const newReleases = [];
        const currentDate = new Date();
        const cutoffDate = new Date(
            currentDate.getTime() -
                CONFIG.NEW_RELEASE_DAYS * 24 * 60 * 60 * 1000
        );
        const isbnMode = authorInfo.isbnMode || 0;

        // 最初の数冊のみチェック（検索結果は日付順でソートされている）
        const booksToCheck = Array.from(searchResults).slice(0, 10);

        for (let i = 0; i < booksToCheck.length; i++) {
            const item = booksToCheck[i];

            const basicInfo = checkBookBasicInfo(item);
            if (!basicInfo.isValid) {
                continue;
            }

            const { title, bookUrl } = basicInfo;
            const asin = extractAsinFromUrl(bookUrl);

            if (!asin) {
                continue;
            }

            if (checkISBNFiltering(asin, isbnMode)) {
                continue;
            }

            if (checkAlreadyNotified(asin)) {
                continue;
            }

            if (checkExcludedKeywords(title, excludedKeywords)) {
                continue;
            }

            const priceInfo = checkBookPrice(item);
            if (priceInfo.shouldSkip) {
                continue;
            }

            if (!checkAuthorMatch(item, authorInfo)) {
                continue;
            }

            const dateInfo = checkReleaseDate(item, cutoffDate);
            if (dateInfo.releaseDate && dateInfo.isNewRelease) {
                const bookData = {
                    title,
                    url: bookUrl.split('?')[0],
                    releaseDate: dateInfo.releaseDate.toISOString(),
                    author: authorInfo.Name,
                    price: priceInfo.price,
                    asin: asin
                };
                newReleases.push(bookData);
            }
        }

        return {
            ...authorInfo,
            newReleases
        };
    };

    const checkBookBasicInfo = (item) => {
        const titleElement = item.querySelector(
            '.s-title-instructions-style a h2 span'
        );
        const title = titleElement?.innerText?.trim() || '';
        const linkElement =
            titleElement?.closest('a') ||
            item.querySelector('h2 a, .a-link-normal[href*="/dp/"]');
        const bookUrl = linkElement?.href || '';

        return { title, bookUrl, isValid: !!(title && bookUrl) };
    };

    const checkISBNFiltering = (asin, isbnMode) => {
        const isBookISBN = isISBN(asin);

        switch (isbnMode) {
            case 0:
                if (isBookISBN) {
                    return true;
                }
                break;
            case 1:
                if (!isBookISBN) {
                    return true;
                }
                break;
            case 2:
                break;
            default:
                if (isBookISBN) {
                    return true;
                }
                break;
        }

        return false;
    };

    const checkAlreadyNotified = (asin) => {
        if (
            asin &&
            isAlreadyStored(
                CONFIG.LOCAL_STORAGE_KEYS.NOTIFICATIONS,
                (item) => item.asin === asin
            )
        ) {
            return true;
        }
        return false;
    };

    const checkExcludedKeywords = (title, excludedKeywords) => {
        const hasExcludedKeyword = excludedKeywords.some((keyword) =>
            title.includes(keyword)
        );
        if (hasExcludedKeyword) {
            return true;
        }
        return false;
    };

    const checkBookPrice = (item) => {
        const priceElement = item.querySelector('span.a-offscreen');
        const priceText = priceElement?.innerText?.trim() || '';
        let price = null;

        if (priceText) {
            const priceMatch = priceText.match(/￥([\d,]+)/);
            if (priceMatch) {
                price = parseInt(priceMatch[1].replace(/,/g, ''), 10);

                if (price <= CONFIG.MIN_PRICE) {
                    return { price, shouldSkip: true };
                }
            }
        }

        return { price, shouldSkip: false };
    };

    const checkAuthorMatch = (item, authorInfo) => {
        const authorElement = item.querySelector('.a-size-base');

        return (authorElement?.innerText?.trim() || '').includes(
            authorInfo.Name
        );
    };

    const checkReleaseDate = (item, cutoffDate) => {
        const dateElement = item.querySelector(
            '.puis-desktop-list-row .puisg-col-4-of-24 div:nth-child(2) div:nth-child(2) span span'
        );

        const releaseDate = parseDateFromText(
            dateElement?.innerText?.trim() || ''
        );

        if (releaseDate) {
            const isNewRelease = releaseDate > cutoffDate;

            return { releaseDate, isNewRelease };
        } else {
            return { releaseDate: null, isNewRelease: false };
        }
    };

    const parseDateFromText = (dateText) => {
        if (!dateText) return null;

        // "発売予定日は2025年10月27日です。" 形式から日付を抽出
        const dateMatch = dateText.match(
            /(\d{4})年(\d{1,2})月(\d{1,2})日|(\d{4})\/(\d{1,2})\/(\d{1,2})/
        );
        if (dateMatch) {
            let releaseDate;
            if (dateMatch[1]) {
                releaseDate = new Date(
                    dateMatch[1],
                    dateMatch[2] - 1,
                    dateMatch[3]
                );
            } else if (dateMatch[4]) {
                releaseDate = new Date(
                    dateMatch[4],
                    dateMatch[5] - 1,
                    dateMatch[6]
                );
            }
            return releaseDate;
        }
        return null;
    };

    const checkNewReleaseConditions = (info) => {
        return info.newReleases && info.newReleases.length > 0;
    };

    unsafeWindow.checkNewReleases = checkNewReleases;

    console.log('🚀 New Release Checker が読み込まれました');
    console.log(
        '💡 デベロッパーツールで checkNewReleases(isbnMode) を実行してください'
    );
    console.log(
        '💡 isbnMode: 0=ISBNスキップ(デフォルト), 1=ISBNのみ, 2=どちらも表示'
    );
})();
