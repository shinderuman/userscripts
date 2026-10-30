(function () {
    'use strict';

    const {
        COMMON_CONFIG,
        fetchJsonFromS3,
        fetchDocument,
        fetchPageInfo,
        createRequestLimiter,
        extractAmazonProductInfo,
        extractAmazonSearchBooks,
        selectNewReleaseCandidates,
        isNewRelease,
        getStorageItems,
        openNewReleaseCheckStore,
        sendErrorNotification,
        sendCompletionNotification,
        saveStorageItems,
        cleanupOldStorageItems
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        ...COMMON_CONFIG,
        LOCAL_STORAGE_KEYS: {
            NOTIFICATIONS: 'newReleaseNotifications'
        }
    };

    const checkNewReleases = async (isbnMode = 0) => {
        let checkStore;
        try {
            cleanupOldNotifications();

            console.log(
                `📖 ISBN処理モード: ${getISBNModeDescription(isbnMode)}`
            );

            checkStore = await openNewReleaseCheckStore();
            const [authors, excludedKeywords, checkedAsins] = await Promise.all(
                [
                    fetchAuthors(),
                    fetchExcludedKeywords(),
                    checkStore.getCheckedAsins()
                ]
            );
            console.log(`${authors.length}人をチェックします`);
            const excludedAsins = new Set([
                ...checkedAsins,
                ...getStorageItems(CONFIG.LOCAL_STORAGE_KEYS.NOTIFICATIONS).map(
                    (item) => item.asin
                )
            ]);
            await checkPagesInBatches(
                authors,
                excludedKeywords,
                isbnMode,
                checkStore,
                excludedAsins
            );
        } catch (error) {
            console.error('❌ エラーが発生しました:', error);
            sendErrorNotification('新刊チェック', error.message);
        } finally {
            checkStore?.close();
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

    const checkPagesInBatches = async (
        authors,
        excludedKeywords,
        isbnMode,
        checkStore,
        excludedAsins
    ) => {
        const limitRequest = createRequestLimiter(CONFIG.CONCURRENT_REQUESTS);
        const limitAuthor = createRequestLimiter(CONFIG.CONCURRENT_REQUESTS);
        const productRequests = new Map();
        const checkedThisRun = new Set();
        const getProductInfo = (book) => {
            if (!productRequests.has(book.asin)) {
                productRequests.set(
                    book.asin,
                    limitRequest(() =>
                        fetchPageInfo(
                            book.url,
                            extractAmazonProductInfo,
                            book.title
                        )
                    ).then((info) => {
                        checkedThisRun.add(book.asin);
                        excludedAsins.add(book.asin);
                        return info;
                    })
                );
            }
            return productRequests.get(book.asin);
        };
        let processedCount = 0;
        const newReleaseBooks = new Map();

        await Promise.all(
            authors.map((authorInfo) =>
                limitAuthor(async () => {
                    try {
                        authorInfo.excludedKeywords = excludedKeywords;
                        authorInfo.isbnMode = isbnMode;
                        const pageInfo = await fetchAuthorSearchInfo(
                            authorInfo,
                            limitRequest,
                            getProductInfo,
                            excludedAsins
                        );
                        const hasNewReleases =
                            checkNewReleaseConditions(pageInfo);

                        processedCount++;
                        console.log(
                            `進捗: ${processedCount}/${authors.length} - ${pageInfo.Name}`
                        );

                        if (hasNewReleases) {
                            console.log(
                                `✅ 新刊発見: ${pageInfo.Name} - ${pageInfo.newReleases.length}冊`
                            );
                            pageInfo.newReleases.forEach((book) => {
                                newReleaseBooks.set(book.asin, book);
                            });
                        }

                        return {
                            success: true,
                            info: pageInfo,
                            hasNewReleases
                        };
                    } catch (error) {
                        console.error(`❌ エラー: ${authorInfo.Name}`, error);
                        return { success: false, error };
                    }
                })
            )
        );

        const now = new Date().toLocaleString('ja-JP');
        const newReleaseCount = newReleaseBooks.size;
        console.log(
            `🆗 チェック完了: ${newReleaseCount}冊の新刊を発見しました (${now})`
        );

        if (newReleaseBooks.size > 0) {
            newReleaseBooks.forEach((book) => {
                GM_openInTab(book.url, { active: false });
            });

            saveStorageItems(
                CONFIG.LOCAL_STORAGE_KEYS.NOTIFICATIONS,
                Array.from(newReleaseBooks.values())
            );
        }

        if (checkedThisRun.size > 0) {
            await checkStore.markCheckedAsins(checkedThisRun);
        }

        sendCompletionNotification(
            '新刊チェック',
            authors.length,
            newReleaseCount
        );
    };

    const fetchAuthorSearchInfo = async (
        authorInfo,
        limitRequest,
        getProductInfo,
        excludedAsins
    ) => {
        const searchUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(authorInfo.Name)}&i=digital-text&rh=n%3A2250738051&s=date-desc-rank`;
        console.log(`📄 検索URL: ${searchUrl}`);
        const doc = await limitRequest(() =>
            fetchDocument(searchUrl, authorInfo.Name)
        );
        return extractSearchPageInfo(
            doc,
            authorInfo,
            getProductInfo,
            excludedAsins
        );
    };

    const extractSearchPageInfo = async (
        doc,
        authorInfo,
        getProductInfo,
        excludedAsins
    ) => {
        const candidates = selectNewReleaseCandidates(
            extractAmazonSearchBooks(doc),
            {
                authorName: authorInfo.Name,
                excludedKeywords: authorInfo.excludedKeywords,
                isbnMode: authorInfo.isbnMode,
                excludedAsins
            }
        );
        const cutoffDate = new Date(
            Date.now() - CONFIG.NEW_RELEASE_DAYS * 24 * 60 * 60 * 1000
        );
        const results = await Promise.all(
            candidates.map(async (book) => {
                try {
                    if (
                        (book.releaseDate && book.releaseDate <= cutoffDate) ||
                        (book.kindlePrice !== null &&
                            book.kindlePrice <= CONFIG.MIN_PRICE)
                    )
                        return null;
                    let info = book;
                    if (!book.releaseDate) {
                        const detail = await getProductInfo(book);
                        info = {
                            releaseDate: book.releaseDate ?? detail.releaseDate,
                            kindlePrice: book.kindlePrice
                        };
                    }
                    if (!isNewRelease(info, cutoffDate, CONFIG.MIN_PRICE))
                        return null;
                    return {
                        title: book.title,
                        url: book.url.split('?')[0],
                        releaseDate: info.releaseDate.toISOString(),
                        author: authorInfo.Name,
                        price: info.kindlePrice,
                        asin: book.asin
                    };
                } catch (error) {
                    console.error(
                        `❌ 商品情報の取得に失敗: ${book.title} (${book.url})`,
                        error
                    );
                    return null;
                }
            })
        );
        return { ...authorInfo, newReleases: results.filter(Boolean) };
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
