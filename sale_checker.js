// ==UserScript==
// @name         Wishlist Sale Checker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  指定されたMarkdownファイルからURLを取得し、セール情報をチェックして通知する
// @author       shinderuman
// @match        https://www.amazon.co.jp/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        unsafeWindow
// @icon         https://www.amazon.co.jp/favicon.ico
// ==/UserScript==

(function () {
    "use strict";

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
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: CONFIG.BOOKS_URL,
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const books = JSON.parse(response.responseText);
                            resolve(books);
                        } catch (error) {
                            reject(new Error(`Failed to parse JSON: ${error.message}`));
                        }
                    } else {
                        reject(new Error(`Failed to fetch books: ${response.status}`));
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    // 個別ページの情報を取得
    const fetchPageInfo = (bookInfo) => {
        return new Promise((resolve, reject) => {
            const cleanUrl = bookInfo.URL.split('?')[0]; // アフィリエイトパラメータを除去

            GM_xmlhttpRequest({
                method: "GET",
                url: cleanUrl,
                onload: (response) => {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const info = extractPageInfo(doc, bookInfo);
                        resolve(info);
                    } else {
                        reject(new Error(`Failed to fetch page: ${response.status}`));
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    // ページから価格・ポイント情報を抽出
    const extractPageInfo = (doc, bookInfo) => {
        const getElementValue = (selector, regex) => {
            const element = doc.querySelector(selector);
            if (!element) return 0;
            const match = element.innerText.match(regex);
            return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
        };

        const title = doc.querySelector(SELECTORS.title)?.innerText.trim() || bookInfo.Title;
        const points = getElementValue(SELECTORS.points, /(\d+)pt/);
        const kindlePrice = getElementValue(SELECTORS.kindlePrice, /([\d,]+)/);
        const paperPrice = getElementValue(SELECTORS.paperPrice, /([\d,]+)/);

        return {
            ...bookInfo,
            title,
            points,
            kindlePrice,
            paperPrice,
            cleanUrl: bookInfo.URL.split('?')[0]
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
        GM_notification({
            title: `🎉 セール発見: ${info.title}`,
            text: `条件達成: ${conditions}`,
            image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
            timeout: 0,
            onclick: () => {
                GM_openInTab(info.cleanUrl, { active: true });
            }
        });
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
                    const pageInfo = await fetchPageInfo(bookInfo);
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
        GM_notification({
            title: "📚 セールチェック完了",
            text: `${books.length}冊中 ${saleCount}件のセールを発見`,
            image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
            timeout: 5000
        });
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
    window.checkWishlistSales = checkWishlistSales;

    // unsafeWindowも試す（Tampermonkey環境によっては必要）
    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.checkWishlistSales = checkWishlistSales;
    }

    console.log("🚀 Wishlist Sale Checker が読み込まれました");
    console.log("💡 デベロッパーツールで checkWishlistSales() を実行してください");

})();