// ==UserScript==
// @name         Paper to Kindle Checker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  紙書籍とKindle版の両方が利用可能な商品をチェックして通知する
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
        BOOKS_URL: "https://kindle-asins.s3.ap-northeast-1.amazonaws.com/paper_books_asins.json",
        CONCURRENT_REQUESTS: 20, // 同時リクエスト数
        REQUEST_DELAY: 1000, // リクエスト間隔（ミリ秒）
    };

    const SELECTORS = {
        title: "#productTitle",
        paperBookAvailable: "[id^='tmm-grid-swatch']:not([id$='KINDLE'])",
        kindleBookAvailable: "#tmm-grid-swatch-KINDLE",
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

    // ページから利用可能性情報を抽出
    const extractPageInfo = (doc, bookInfo) => {
        const title = doc.querySelector(SELECTORS.title)?.innerText.trim() || bookInfo.Title;
        const paperBookAvailable = doc.querySelector(SELECTORS.paperBookAvailable);
        const kindleBookAvailable = doc.querySelector(SELECTORS.kindleBookAvailable);

        return {
            ...bookInfo,
            title,
            paperBookAvailable: !!paperBookAvailable,
            kindleBookAvailable: !!kindleBookAvailable,
            cleanUrl: bookInfo.URL.split('?')[0]
        };
    };

    // 利用可能性条件をチェック
    const checkAvailabilityConditions = (info) => {
        return info.paperBookAvailable && info.kindleBookAvailable;
    };

    // 通知を送信
    const sendAvailabilityNotification = (info) => {
        GM_notification({
            title: `📚 紙書籍・Kindle両方利用可能`,
            text: `${info.title}`,
            image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
            timeout: 0,
            onclick: () => {
                // 紙書籍のページを開く
                GM_openInTab(info.cleanUrl, { active: true });
            }
        });
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
                    const pageInfo = await fetchPageInfo(bookInfo);
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

        console.log(`✅ チェック完了: ${availableCount}件が両方利用可能でした`);

        // 完了通知
        GM_notification({
            title: "📚 利用可能性チェック完了",
            text: `${books.length}冊中 ${availableCount}件が紙書籍・Kindle両方利用可能`,
            image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
            timeout: 5000
        });
    };

    // メイン関数
    const checkPaperToKindle = async () => {
        try {
            console.log("📖 書籍データを取得中...");
            const books = await fetchBooks();
            console.log(`📚 ${books.length}冊をチェックします`);

            console.log("📖 紙書籍とKindle版の利用可能性をチェック中...");
            await checkPagesInBatches(books);
        } catch (error) {
            console.error("❌ エラーが発生しました:", error);
            GM_notification({
                title: "❌ エラー",
                text: "利用可能性チェック中にエラーが発生しました",
                image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
                timeout: 5000
            });
        }
    };

    // グローバル関数として公開（デベロッパーツールから呼び出し可能）
    window.checkPaperToKindle = checkPaperToKindle;

    // unsafeWindowも試す（Tampermonkey環境によっては必要）
    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.checkPaperToKindle = checkPaperToKindle;
    }

    console.log("🚀 Paper to Kindle Checker が読み込まれました");
    console.log("💡 デベロッパーツールで checkPaperToKindle() を実行してください");

})();