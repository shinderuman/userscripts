(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        COMMON_CONFIG,
        fetchJsonFromS3,
        fetchPageInfo,
        sendNotification,
        sendCompletionNotification
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        ...COMMON_CONFIG
    };

    const SELECTORS = {
        title: '#productTitle',
        paperBookAvailable: '[id^=\'tmm-grid-swatch\']:not([id$=\'KINDLE\'])',
        kindleBookAvailable: '#tmm-grid-swatch-KINDLE'
    };

    // 書籍データをS3から取得
    const fetchBooks = () => {
        return fetchJsonFromS3(CONFIG.PAPER_BOOKS_URL, 'books');
    };

    // 個別ページの情報を取得
    const fetchBookPageInfo = (bookInfo) => {
        return fetchPageInfo(`https://www.amazon.co.jp/dp/${bookInfo.ASIN}`, (doc, cleanUrl) => extractPageInfo(doc, bookInfo, cleanUrl));
    };

    // ページから利用可能性情報を抽出
    const extractPageInfo = (doc, bookInfo, cleanUrl) => {
        const title = doc.querySelector(SELECTORS.title)?.innerText.trim() || bookInfo.Title;
        const paperBookAvailable = doc.querySelector(SELECTORS.paperBookAvailable);
        const kindleBookAvailable = doc.querySelector(SELECTORS.kindleBookAvailable);

        return {
            ...bookInfo,
            title,
            paperBookAvailable: !!paperBookAvailable,
            kindleBookAvailable: !!kindleBookAvailable,
            cleanUrl
        };
    };

    // 利用可能性条件をチェック
    const checkAvailabilityConditions = (info) => {
        return info.paperBookAvailable && info.kindleBookAvailable;
    };

    // 通知を送信
    const sendAvailabilityNotification = (info) => {
        sendNotification(
            '📚 紙書籍・Kindle両方利用可能',
            `${info.title}`,
            info.cleanUrl
        );
    };

    // 非同期でページをチェック（バッチ処理）
    const checkPagesInBatches = async (books) => {
        console.log(`📚 ${books.length}冊の利用可能性をチェック開始...`);

        let availableCount = 0;
        let processedCount = 0;

        for (let i = 0; i < books.length; i += CONFIG.CONCURRENT_REQUESTS) {
            const batch = books.slice(i, i + CONFIG.CONCURRENT_REQUESTS);

            const promises = batch.map(async (bookInfo) => {
                try {
                    const pageInfo = await fetchBookPageInfo(bookInfo);
                    const isAvailable = checkAvailabilityConditions(pageInfo);

                    processedCount++;
                    console.log(`進捗: ${processedCount}/${books.length} - ${pageInfo.title}`);
                    console.log(`  紙書籍: ${pageInfo.paperBookAvailable ? '✅' : '❌'}, Kindle: ${pageInfo.kindleBookAvailable ? '✅' : '❌'}`);

                    if (isAvailable) {
                        availableCount++;
                        console.log(`📚 両方利用可能: ${pageInfo.title}`);
                        sendAvailabilityNotification(pageInfo);
                    }

                    return { success: true, info: pageInfo, isAvailable };
                } catch (error) {
                    console.error(`❌ エラー: ${bookInfo.URL}`, error);
                    return { success: false, error };
                }
            });

            await Promise.all(promises);

            // 次のバッチまで待機（レート制限対策）
            if (i + CONFIG.CONCURRENT_REQUESTS < books.length) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.REQUEST_DELAY));
            }
        }

        const now = new Date().toLocaleString('ja-JP');
        console.log(`✅ チェック完了: ${availableCount}件が両方利用可能でした (${now})`);

        // 完了通知
        sendCompletionNotification('利用可能性チェック', books.length, availableCount);
    };

    // メイン関数
    const checkPaperToKindle = async () => {
        try {
            console.log('📖 書籍データを取得中...');
            const books = await fetchBooks();
            console.log(`📚 ${books.length}冊をチェックします`);

            console.log('📖 紙書籍とKindle版の利用可能性をチェック中...');
            await checkPagesInBatches(books);
        } catch (error) {
            console.error('❌ エラーが発生しました:', error);
            GM_notification({
                title: '❌ エラー',
                text: '利用可能性チェック中にエラーが発生しました',
                image: 'https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp',
                timeout: 5000
            });
        }
    };

    // グローバル関数として公開（デベロッパーツールから呼び出し可能）
    unsafeWindow.checkPaperToKindle = checkPaperToKindle;

    console.log('🚀 Paper to Kindle Checker が読み込まれました');
    console.log('💡 デベロッパーツールで checkPaperToKindle() を実行してください');
})();