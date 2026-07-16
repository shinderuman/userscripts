(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        COMMON_CONFIG,
        fetchJsonFromS3,
        fetchPageInfo,
        sendCompletionNotification,
        extractAmazonProductInfo,
        evaluateSaleConditions
    } = unsafeWindow.KindleCommon;

    // セール発見通知を送信
    const sendBatchSaleNotification = (saleBooks) => {
        const count = saleBooks.length;
        const title = `🎉 ${count}件のセールを発見`;

        let text = saleBooks
            .slice(0, 2)
            .map((book) => `• ${book.info.title}`)
            .join('\n');
        if (count > 2) {
            text += `\n... 他${count - 2}件`;
        }

        GM_notification({
            title: title,
            text: text,
            image: 'https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp',
            timeout: 0,
            onclick: () => {
                saleBooks.forEach((book, index) => {
                    GM_openInTab(book.info.URL, { active: index === 0 });
                });
            }
        });
    };

    // 非同期でページをチェック（バッチ処理）
    const checkPagesInBatches = async (books) => {
        console.log(`📚 ${books.length}冊のセール情報をチェック開始...`);

        let processedCount = 0;
        const saleBooks = [];

        for (
            let i = 0;
            i < books.length;
            i += COMMON_CONFIG.CONCURRENT_REQUESTS
        ) {
            const batch = books.slice(i, i + COMMON_CONFIG.CONCURRENT_REQUESTS);

            const promises = batch.map(async (bookInfo) => {
                try {
                    const pageInfo = await fetchPageInfo(
                        bookInfo.URL,
                        (doc, cleanUrl) => {
                            const productInfo = extractAmazonProductInfo(
                                doc,
                                `(${cleanUrl})`
                            );

                            return {
                                ...bookInfo,
                                title: productInfo.title || bookInfo.Title,
                                points: productInfo.points,
                                kindlePrice: productInfo.kindlePrice,
                                paperPrice: productInfo.paperPrice,
                                hasCoupon: productInfo.hasCoupon,
                                cleanUrl
                            };
                        },
                        bookInfo.Title
                    );
                    const conditions = evaluateSaleConditions(pageInfo);

                    processedCount++;
                    console.log(
                        `進捗: ${processedCount}/${books.length} - ${pageInfo.title}`
                    );

                    if (conditions) {
                        console.log(
                            `🎉 セール発見: ${pageInfo.title} - ${conditions}`
                        );
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
            if (i + COMMON_CONFIG.CONCURRENT_REQUESTS < books.length) {
                await new Promise((resolve) =>
                    setTimeout(resolve, COMMON_CONFIG.REQUEST_DELAY)
                );
            }
        }

        const now = new Date().toLocaleString('ja-JP');
        console.log(
            `✅ チェック完了: ${saleBooks.length}件のセールを発見しました (${now})`
        );

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
            const books = await fetchJsonFromS3(
                COMMON_CONFIG.UNPROCESSED_BOOKS_URL,
                'books'
            );
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
    console.log(
        '💡 デベロッパーツールで checkWishlistSales() を実行してください'
    );
})();
