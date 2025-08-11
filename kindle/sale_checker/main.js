(function () {
    "use strict";

    // 共通ライブラリから関数を取得
    const {
        fetchJsonFromS3,
        fetchPageInfo,
        sendNotification,
        sendCompletionNotification,
        getElementValue
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        BOOKS_URL: "https://kindle-asins.s3.ap-northeast-1.amazonaws.com/unprocessed_asins.json",
        THRESHOLD: 151,
        POINTS_RATE_THRESHOLD: 20,
        AVERAGE_PRICE_THRESHOLD: 350,
        CONCURRENT_REQUESTS: 20, // 同時リクエスト数
        REQUEST_DELAY: 1000, // リクエスト間隔（ミリ秒）
    };

    const SELECTORS = {
        title: "#productTitle",
        kindlePrice: "#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span",
        paperPrice: "[id^='tmm-grid-swatch']:not([id$='KINDLE']) > span.a-button > span.a-button-inner > a.a-button-text > span.slot-price > span",
        points: "#tmm-grid-swatch-KINDLE > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span, #tmm-grid-swatch-OTHER > span.a-button > span.a-button-inner > a.a-button-text > span.slot-buyingPoints > span",
    };

    // 書籍データをS3から取得
    const fetchBooks = () => {
        return fetchJsonFromS3(CONFIG.BOOKS_URL, "books");
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
        let conditions = [];

        if (points >= CONFIG.THRESHOLD) {
            conditions.push(`✅ポイント ${points}pt`);
        }
        if (kindlePrice && (points / kindlePrice) * 100 >= CONFIG.POINTS_RATE_THRESHOLD) {
            conditions.push(`✅ポイント還元 ${(points / kindlePrice * 100).toFixed(2)}%`);
        }
        if (paperPrice && kindlePrice > 0 && paperPrice - kindlePrice >= CONFIG.THRESHOLD) {
            conditions.push(`✅価格差 ${paperPrice - kindlePrice}円`);
        }

        return conditions.length > 0 ? conditions.join(' ') : null;
    };

    // 通知を送信
    const sendSaleNotification = (info, conditions) => {
        sendNotification(
            `🎉 セール発見: ${info.title}`,
            `条件達成: ${conditions}`,
            info.cleanUrl
        );
    };

    // 非同期でページをチェック（バッチ処理）
    const checkPagesInBatches = async (books) => {
        console.log(`📚 ${books.length}冊のセール情報をチェック開始...`);

        let saleCount = 0;
        let processedCount = 0;

        for (let i = 0; i < books.length; i += CONFIG.CONCURRENT_REQUESTS) {
            const batch = books.slice(i, i + CONFIG.CONCURRENT_REQUESTS);

            const promises = batch.map(async (bookInfo) => {
                try {
                    const pageInfo = await fetchBookPageInfo(bookInfo);
                    const conditions = checkSaleConditions(pageInfo);

                    processedCount++;
                    console.log(`進捗: ${processedCount}/${books.length} - ${pageInfo.title}`);

                    if (conditions) {
                        saleCount++;
                        console.log(`🎉 セール発見: ${pageInfo.title} - ${conditions}`);
                        sendSaleNotification(pageInfo, conditions);
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

        console.log(`✅ チェック完了: ${saleCount}件のセールを発見しました`);

        // 完了通知
        sendCompletionNotification("セールチェック", books.length, saleCount);
    };

    // メイン関数
    const checkWishlistSales = async () => {
        try {
            console.log("📖 書籍データを取得中...");
            const books = await fetchBooks();
            console.log(`📚 ${books.length}冊をチェックします`);

            console.log("📖 セール情報をチェック中...");
            await checkPagesInBatches(books);
        } catch (error) {
            console.error("❌ エラーが発生しました:", error);
            GM_notification({
                title: "❌ エラー",
                text: "セールチェック中にエラーが発生しました",
                image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
                timeout: 5000
            });
        }
    };

    // グローバル関数として公開（デベロッパーツールから呼び出し可能）
    unsafeWindow.checkWishlistSales = checkWishlistSales;

    console.log("🚀 Wishlist Sale Checker が読み込まれました");
    console.log("💡 デベロッパーツールで checkWishlistSales() を実行してください");
})();