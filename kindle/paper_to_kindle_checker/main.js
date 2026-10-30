(function () {
    'use strict';

    const {
        COMMON_CONFIG,
        processBatch,
        extractAmazonProductInfo,
        fetchJsonFromS3,
        fetchPageInfo,
        sendCompletionNotification,
        sendNotification
    } = unsafeWindow.KindleCommon;

    const fetchBooks = () => {
        return fetchJsonFromS3(COMMON_CONFIG.PAPER_BOOKS_URL, 'books');
    };

    const fetchBookPageInfo = (bookInfo) => {
        return fetchPageInfo(
            `https://www.amazon.co.jp/dp/${bookInfo.ASIN}`,
            (doc, cleanUrl) => extractPageInfo(doc, bookInfo, cleanUrl),
            bookInfo.Title
        );
    };

    const extractPageInfo = (doc, bookInfo, cleanUrl) => {
        const info = extractAmazonProductInfo(doc, cleanUrl);
        return {
            ...bookInfo,
            title: info.title || bookInfo.Title,
            paperBookAvailable: info.paperBookAvailable,
            kindleBookAvailable: info.kindleBookAvailable,
            cleanUrl
        };
    };

    const checkAvailabilityConditions = (info) => {
        return info.paperBookAvailable && info.kindleBookAvailable;
    };

    const checkPagesInBatches = async (books) => {
        console.log(`📚 ${books.length}冊の利用可能性をチェック開始...`);

        let availableCount = 0;
        let processedCount = 0;
        const availableBooks = [];

        await processBatch(
            books,
            async (bookInfo) => {
                try {
                    const pageInfo = await fetchBookPageInfo(bookInfo);
                    const isAvailable = checkAvailabilityConditions(pageInfo);

                    processedCount++;
                    console.log(
                        `進捗: ${processedCount}/${books.length} - ${pageInfo.title}`
                    );
                    console.log(
                        `  紙書籍: ${pageInfo.paperBookAvailable ? '✅' : '❌'}, Kindle: ${pageInfo.kindleBookAvailable ? '✅' : '❌'}`
                    );

                    if (isAvailable) {
                        availableCount++;
                        console.log(`📚 両方利用可能: ${pageInfo.title}`);
                        availableBooks.push(pageInfo);
                    }

                    return { success: true, info: pageInfo, isAvailable };
                } catch (error) {
                    console.error(`❌ エラー: ${bookInfo.URL}`, error);
                    return { success: false, error };
                }
            },
            COMMON_CONFIG
        );

        const now = new Date().toLocaleString('ja-JP');
        console.log(
            `✅ チェック完了: ${availableCount}件が両方利用可能でした (${now})`
        );

        if (availableBooks.length > 0) {
            availableBooks.forEach((pageInfo) => {
                GM_openInTab(pageInfo.cleanUrl, { active: false });
            });
        }

        sendCompletionNotification(
            '利用可能性チェック',
            books.length,
            availableCount
        );
    };

    const checkPaperToKindle = async () => {
        try {
            console.log('📖 書籍データを取得中...');
            const books = await fetchBooks();
            console.log(`📚 ${books.length}冊をチェックします`);

            console.log('📖 紙書籍とKindle版の利用可能性をチェック中...');
            await checkPagesInBatches(books);
        } catch (error) {
            console.error('❌ エラーが発生しました:', error);
            sendNotification(
                '❌ エラー',
                '利用可能性チェック中にエラーが発生しました',
                null,
                5000
            );
        }
    };

    unsafeWindow.checkPaperToKindle = checkPaperToKindle;

    console.log('🚀 Paper to Kindle Checker が読み込まれました');
    console.log(
        '💡 デベロッパーツールで checkPaperToKindle() を実行してください'
    );
})();
