// ==UserScript==
// @name         New Release Checker
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  作者の新しく発売されたKindle書籍をチェックして通知する
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
        AUTHORS_URL: "https://kindle-asins.s3.ap-northeast-1.amazonaws.com/authors.json",
        EXCLUDED_KEYWORDS_URL: "https://kindle-asins.s3.ap-northeast-1.amazonaws.com/excluded_title_keywords.json",
        CONCURRENT_REQUESTS: 20, // 同時リクエスト数
        REQUEST_DELAY: 1000, // リクエスト間隔（ミリ秒）
        NEW_RELEASE_DAYS: 7, // 何日以内を新刊とするか
        MIN_PRICE: 221, // 最低価格（円）
    };

    // S3からJSONデータを取得する共通関数
    const fetchJsonFromS3 = (url, dataType) => {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (error) {
                            reject(new Error(`Failed to parse ${dataType} JSON: ${error.message}`));
                        }
                    } else {
                        reject(new Error(`Failed to fetch ${dataType}: ${response.status}`));
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    // 作者データをS3から取得
    const fetchAuthors = () => {
        return fetchJsonFromS3(CONFIG.AUTHORS_URL, "authors");
    };

    // 除外キーワードをS3から取得
    const fetchExcludedKeywords = () => {
        return fetchJsonFromS3(CONFIG.EXCLUDED_KEYWORDS_URL, "excluded keywords");
    };

    // URLからASINを抽出
    const extractAsinFromUrl = (url) => {
        const match = url.match(/\/dp\/([A-Z0-9]{10})/);
        return match ? match[1] : null;
    };

    // ASINがISBN（紙書籍）かどうかをチェック
    const isIsbn = (asin) => {
        if (!asin) return false;
        // ISBNは通常10桁または13桁の数字で構成される
        // Kindle書籍のASINは通常英数字の組み合わせ
        return /^\d{10}$|^\d{13}$/.test(asin);
    };

    // 検索結果から発売日テキストを解析
    const parseDateFromText = (dateText) => {
        if (!dateText) return null;

        console.log(`📅 日付解析中: "${dateText}"`);

        // "発売予定日は2025年10月27日です。" 形式から日付を抽出
        const dateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日|(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        if (dateMatch) {
            let releaseDate;
            if (dateMatch[1]) {
                // YYYY年MM月DD日形式
                releaseDate = new Date(dateMatch[1], dateMatch[2] - 1, dateMatch[3]);
            } else if (dateMatch[4]) {
                // YYYY/MM/DD形式
                releaseDate = new Date(dateMatch[4], dateMatch[5] - 1, dateMatch[6]);
            }
            console.log(`📅 解析結果: ${releaseDate?.toISOString()}`);
            return releaseDate;
        }
        console.log(`❌ 日付パターンが見つかりません`);
        return null;
    };

    // 作者の検索結果ページの情報を取得
    const fetchAuthorSearchInfo = async (authorInfo) => {
        return new Promise((resolve, reject) => {
            // 作者名でKindleマンガを検索するURL
            const searchUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(authorInfo.Name)}&i=digital-text&rh=n%3A2250738051&s=date-desc-rank`;

            console.log(`🔍 検索中: ${authorInfo.Name}`);
            console.log(`📄 検索URL: ${searchUrl}`);

            GM_xmlhttpRequest({
                method: "GET",
                url: searchUrl,
                onload: async (response) => {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');

                        console.log(`📄 検索結果ページタイトル: ${doc.title}`);

                        const info = await extractSearchPageInfo(doc, authorInfo, authorInfo.excludedKeywords);
                        resolve(info);
                    } else {
                        console.log(`❌ 検索ページ取得失敗: ${response.status}`);
                        reject(new Error(`Failed to fetch search page: ${response.status}`));
                    }
                },
                onerror: (error) => {
                    console.log(`❌ 検索リクエストエラー: ${error}`);
                    reject(error);
                }
            });
        });
    };

    // 検索結果ページから新刊情報を抽出
    const extractSearchPageInfo = async (doc, authorInfo, excludedKeywords) => {
        const searchResults = doc.querySelectorAll('[data-component-type="s-search-result"]');
        const newReleases = [];
        const currentDate = new Date();
        const cutoffDate = new Date(currentDate.getTime() - (CONFIG.NEW_RELEASE_DAYS * 24 * 60 * 60 * 1000));

        console.log(`📊 検索結果: ${searchResults.length}件`);
        console.log(`📅 新刊判定基準日: ${cutoffDate.toISOString()}`);

        // 最初の数冊のみチェック（検索結果は日付順でソートされている）
        const booksToCheck = Array.from(searchResults).slice(0, 10);
        console.log(`📚 チェック対象: ${booksToCheck.length}冊`);

        for (let i = 0; i < booksToCheck.length; i++) {
            const item = booksToCheck[i];
            console.log(`\n📖 書籍 ${i + 1}/${booksToCheck.length} をチェック中...`);

            // タイトルを取得（特定のセレクタを使用）
            const titleElement = item.querySelector('.s-title-instructions-style a h2 span');
            const title = titleElement?.innerText?.trim() || '';
            // URLを取得（タイトル要素の親のaタグから）
            const linkElement = titleElement?.closest('a') || item.querySelector('h2 a, .a-link-normal[href*="/dp/"]');
            const bookUrl = linkElement?.href || '';

            if (title && bookUrl) {
                console.log(`✅ タイトル取得成功: "${title}"`);
            }

            console.log(`📚 タイトル: "${title}"`);
            console.log(`🔗 URL: ${bookUrl}`);

            if (!title || !bookUrl) {
                console.log(`⏭️ スキップ: タイトルまたはURLが見つかりません`);
                // デバッグ用：利用可能な要素を表示
                const allH2 = item.querySelectorAll('h2, h2 span, h2 a, h2 a span');
                console.log(`🔍 利用可能なh2要素: ${allH2.length}個`);
                allH2.forEach((el, idx) => {
                    console.log(`  ${idx}: "${el.innerText?.trim() || ''}" (${el.tagName})`);
                });
                continue;
            }

            // ASINを抽出してISBN（紙書籍）かどうかチェック
            const asin = extractAsinFromUrl(bookUrl);
            if (asin && isIsbn(asin)) {
                console.log(`⏭️ スキップ: 紙書籍です (ASIN: ${asin})`);
                continue;
            }
            console.log(`📖 ASIN: ${asin} (Kindle書籍)`);

            // 除外キーワードチェック
            const hasExcludedKeyword = excludedKeywords.some(keyword => title.includes(keyword));
            if (hasExcludedKeyword) {
                const matchedKeyword = excludedKeywords.find(keyword => title.includes(keyword));
                console.log(`⏭️ スキップ: 除外キーワード "${matchedKeyword}" が含まれています`);
                continue;
            }

            // 価格チェック
            const priceElement = item.querySelector('span.a-offscreen');
            const priceText = priceElement?.innerText?.trim() || '';
            let price = null;

            if (priceText) {
                const priceMatch = priceText.match(/￥(\d+)/);
                if (priceMatch) {
                    price = parseInt(priceMatch[1], 10);
                    console.log(`💰 価格: ${price}円`);

                    if (price <= CONFIG.MIN_PRICE) {
                        console.log(`⏭️ スキップ: 価格が${CONFIG.MIN_PRICE}円以下です (${price}円)`);
                        continue;
                    }
                } else {
                    console.log(`💰 価格: テキスト解析失敗 "${priceText}"`);
                }
            } else {
                console.log(`💰 価格: 取得できませんでした（継続）`);
            }

            // 作者名が含まれているかチェック
            const authorElement = item.querySelector('.a-size-base');
            const authorText = authorElement?.innerText?.trim() || '';
            const isAuthorMatch = authorText.includes(authorInfo.Name);

            console.log(`👤 作者情報: "${authorText}"`);
            console.log(`✅ 作者マッチ: ${isAuthorMatch}`);

            if (!isAuthorMatch) {
                console.log(`⏭️ スキップ: 作者が一致しません`);
                continue;
            }

            // 検索結果ページから直接発売日を取得
            const dateElement = item.querySelector('.puis-desktop-list-row .puisg-col-4-of-24 div:nth-child(2) div:nth-child(2) span span');
            const releaseDateText = dateElement?.innerText?.trim() || '';

            console.log(`📅 発売日テキスト: "${releaseDateText}"`);

            const releaseDate = parseDateFromText(releaseDateText);

            if (releaseDate) {
                const isNewRelease = releaseDate > cutoffDate;

                console.log(`📅 発売日: ${releaseDate.toISOString()}`);
                console.log(`🆕 新刊判定: ${isNewRelease}`);

                // 新刊かどうかチェック
                if (isNewRelease) {
                    newReleases.push({
                        title,
                        url: bookUrl.split('?')[0],
                        releaseDate: releaseDate.toISOString(),
                        author: authorInfo.Name,
                        price: price
                    });
                    console.log(`✅ 新刊として追加しました`);
                }
            } else {
                console.log(`❌ 発売日を解析できませんでした`);
            }
        }

        console.log(`\n📊 ${authorInfo.Name}の結果: ${newReleases.length}冊の新刊を発見`);
        return {
            ...authorInfo,
            newReleases
        };
    };

    // 新刊条件をチェック
    const checkNewReleaseConditions = (info) => {
        return info.newReleases && info.newReleases.length > 0;
    };

    // 通知を送信
    const sendNewReleaseNotification = (info) => {
        info.newReleases.forEach(book => {
            GM_notification({
                title: `📚 ${info.Name}の新刊発見`,
                text: `${book.title}`,
                image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
                timeout: 0,
                onclick: () => {
                    GM_openInTab(book.url, { active: true });
                }
            });
        });
    };

    // 非同期でページをチェック（バッチ処理）
    const checkPagesInBatches = async (authors, excludedKeywords) => {
        console.log(`📚 ${authors.length}人の作者の新刊をチェック開始...`);

        let newReleaseCount = 0;
        let processedCount = 0;

        for (let i = 0; i < authors.length; i += CONFIG.CONCURRENT_REQUESTS) {
            const batch = authors.slice(i, i + CONFIG.CONCURRENT_REQUESTS);

            const promises = batch.map(async (authorInfo) => {
                try {
                    // 除外キーワードを渡す
                    authorInfo.excludedKeywords = excludedKeywords;
                    const pageInfo = await fetchAuthorSearchInfo(authorInfo);
                    const hasNewReleases = checkNewReleaseConditions(pageInfo);

                    processedCount++;
                    console.log(`進捗: ${processedCount}/${authors.length} - ${pageInfo.Name}`);
                    console.log(`  新刊: ${pageInfo.newReleases.length}冊`);

                    if (hasNewReleases) {
                        newReleaseCount += pageInfo.newReleases.length;
                        console.log(`📚 新刊発見: ${pageInfo.Name} - ${pageInfo.newReleases.length}冊`);
                        pageInfo.newReleases.forEach(book => {
                            console.log(`  - ${book.title} (${book.releaseDate})`);
                        });
                        sendNewReleaseNotification(pageInfo);
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
                await new Promise(resolve => setTimeout(resolve, CONFIG.REQUEST_DELAY));
            }
        }

        console.log(`✅ チェック完了: ${newReleaseCount}冊の新刊を発見しました`);

        // 完了通知
        GM_notification({
            title: "📚 新刊チェック完了",
            text: `${authors.length}人中 ${newReleaseCount}冊の新刊を発見`,
            image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
            timeout: 5000
        });
    };

    // メイン関数
    const checkNewReleases = async () => {
        try {
            console.log("📖 作者データを取得中...");
            const authors = await fetchAuthors();
            console.log(`📚 ${authors.length}人をチェックします`);

            console.log("📖 除外キーワードを取得中...");
            const excludedKeywords = await fetchExcludedKeywords();
            console.log(`🚫 除外キーワード: ${excludedKeywords.join(', ')}`);

            console.log("📖 作者の新刊をチェック中...");
            await checkPagesInBatches(authors, excludedKeywords);
        } catch (error) {
            console.error("❌ エラーが発生しました:", error);
            GM_notification({
                title: "❌ エラー",
                text: "新刊チェック中にエラーが発生しました",
                image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
                timeout: 5000
            });
        }
    };

    // グローバル関数として公開（デベロッパーツールから呼び出し可能）
    window.checkNewReleases = checkNewReleases;

    // unsafeWindowも試す（Tampermonkey環境によっては必要）
    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.checkNewReleases = checkNewReleases;
    }

    console.log("🚀 New Release Checker が読み込まれました");
    console.log("💡 デベロッパーツールで checkNewReleases() を実行してください");

})();