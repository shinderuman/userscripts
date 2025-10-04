(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        COMMON_CONFIG,
        fetchJsonFromS3,
        fetchPageInfo,
        sendCompletionNotification,
        getElementValue
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        ...COMMON_CONFIG
    };

    const SELECTORS = {
        title: '#productTitle',
        kindlePrice: [
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
            '#tmm-grid-swatch-OTHER > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span',
            '#kindle-price',
            '#a-autoid-2-announce > span.slot-price > span',
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-extraMessage .kindleExtraMessage .a-color-price'
        ].join(', '),
        paperPrice: [
            // 紙書籍価格（KINDLE以外）
            '[id^=\'tmm-grid-swatch\']:not([id$=\'KINDLE\']) > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span'
        ].join(', '),
        points: [
            // Kindleポイント
            '#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span',
            // OTHERポイント
            '#tmm-grid-swatch-OTHER > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span'
        ].join(', ')
    };

    // 書籍データをS3から取得
    const fetchBooks = () => {
        return fetchJsonFromS3(CONFIG.UNPROCESSED_BOOKS_URL, 'books');
    };

    // 個別ページの情報を取得
    const fetchBookPageInfo = (bookInfo) => {
        return fetchPageInfo(bookInfo.URL, (doc, cleanUrl) => extractPageInfo(doc, bookInfo, cleanUrl));
    };

    // ページから価格・ポイント情報を抽出
    const extractPageInfo = (doc, bookInfo, cleanUrl) => {
        const title = doc.querySelector(SELECTORS.title)?.innerText.trim() || bookInfo.Title;
        const points = getElementValue(doc, SELECTORS.points, /(\d+)pt/);
        const kindlePrice = getElementValue(doc, SELECTORS.kindlePrice, /([\d,]+)/);
        const paperPrice = getElementValue(doc, SELECTORS.paperPrice, /([\d,]+)/);

        // 取得できなかった値についてログを出力
        if (points === 0) {
            console.warn(`⚠️ ポイント情報を取得できませんでした - ${title} (${cleanUrl})`);
            console.warn('セレクタ:', SELECTORS.points);
        }
        if (kindlePrice === 0) {
            console.warn(`⚠️ Kindle価格情報を取得できませんでした - ${title} (${cleanUrl})`);
            console.warn('セレクタ:', SELECTORS.kindlePrice);
        }
        if (paperPrice === 0) {
            console.log(`📖 紙書籍価格情報を取得できませんでした - ${title} (${cleanUrl})`);
            console.log('セレクタ:', SELECTORS.paperPrice);
        }

        return {
            ...bookInfo,
            title,
            points,
            kindlePrice,
            paperPrice,
            cleanUrl
        };
    };

    // セール条件をチェック
    const checkSaleConditions = (info) => {
        const { points, kindlePrice, paperPrice } = info;
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

        return conditions.length > 0 ? conditions.join(' ') : null;
    };

    // セール発見通知を送信
    const sendBatchSaleNotification = (saleBooks) => {
        const title = `🎉 ${saleBooks.length}件のセールを発見`;
        const text = saleBooks.map(book => `• ${book.info.title}`).join('\n');

        GM_notification({
            title: title,
            text: text,
            image: 'https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp',
            timeout: 0,
            onclick: () => {
                saleBooks.forEach(book => {
                    GM_openInTab(book.info.cleanUrl, { active: false });
                });
            }
        });
    };

    // 非同期でページをチェック（バッチ処理）
    const checkPagesInBatches = async (books) => {
        console.log(`📚 ${books.length}冊のセール情報をチェック開始...`);

        let processedCount = 0;
        const saleBooks = [];

        for (let i = 0; i < books.length; i += CONFIG.CONCURRENT_REQUESTS) {
            const batch = books.slice(i, i + CONFIG.CONCURRENT_REQUESTS);

            const promises = batch.map(async (bookInfo) => {
                try {
                    const pageInfo = await fetchBookPageInfo(bookInfo);
                    const conditions = checkSaleConditions(pageInfo);

                    processedCount++;
                    console.log(`進捗: ${processedCount}/${books.length} - ${pageInfo.title}`);

                    if (conditions) {
                        console.log(`🎉 セール発見: ${pageInfo.title} - ${conditions}`);
                        saleBooks.push({ info: pageInfo, conditions });
                    }

                    return { success: true, info: pageInfo, conditions };
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
        console.log(`✅ チェック完了: ${saleBooks.length}件のセールを発見しました (${now})`);

        // セール発見時は統合通知、未発見時は完了通知
        if (saleBooks.length) {
            sendBatchSaleNotification(saleBooks);
        } else {
            sendCompletionNotification('セールチェック', books.length, 0);
        }
    };

    // メイン関数
    const checkWishlistSales = async () => {
        try {
            console.log('📖 書籍データを取得中...');
            const books = await fetchBooks();
            console.log(`📚 ${books.length}冊をチェックします`);

            console.log('📖 セール情報をチェック中...');
            await checkPagesInBatches(books);
        } catch (error) {
            console.error('❌ エラーが発生しました:', error);
            GM_notification({
                title: '❌ エラー',
                text: 'セールチェック中にエラーが発生しました',
                image: 'https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp',
                timeout: 5000
            });
        }
    };

    // グローバル関数として公開（デベロッパーツールから呼び出し可能）
    unsafeWindow.checkWishlistSales = checkWishlistSales;

    console.log('🚀 Wishlist Sale Checker が読み込まれました');
    console.log('💡 デベロッパーツールで checkWishlistSales() を実行してください');
})();