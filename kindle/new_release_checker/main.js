(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        COMMON_CONFIG,
        fetchJsonFromS3,
        sendErrorNotification,
        sendCompletionNotification,
        extractAsinFromUrl,
        saveStorageItem,
        isAlreadyStored,
        cleanupOldStorageItems
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        ...COMMON_CONFIG,
        LOCAL_STORAGE_KEYS: {
            NOTIFICATIONS: 'newReleaseNotifications'
        }
    };

    // ISBN判定関数
    const isISBN = (asin) => {
        // ISBNは10〜13桁の数値のみで構成される
        if (!asin) return false;

        const length = asin.length;
        return (length >= 10 && length <= 13) && /^\d+$/.test(asin);
    };

    // メイン関数
    const checkNewReleases = async (isbnMode = 0) => {
        try {
            console.log('🧹 古い通知記録をクリーンアップ中...');
            cleanupOldNotifications();

            console.log(`📖 ISBN処理モード: ${getISBNModeDescription(isbnMode)}`);

            console.log('📖 作者データを取得中...');
            const authors = await fetchAuthors();
            console.log(`📚 ${authors.length}人をチェックします`);

            console.log('📖 除外キーワードを取得中...');
            const excludedKeywords = await fetchExcludedKeywords();
            console.log(`🚫 除外キーワード: ${excludedKeywords.join(', ')}`);

            console.log('📖 作者の新刊をチェック中...');
            await checkPagesInBatches(authors, excludedKeywords, isbnMode);
        } catch (error) {
            console.error('❌ エラーが発生しました:', error);
            sendErrorNotification('新刊チェック', error.message);
        }
    };

    const getISBNModeDescription = (mode) => {
        switch (mode) {
        case 0: return '0 (ISBNをスキップ)';
        case 1: return '1 (ISBNのみ表示)';
        case 2: return '2 (どちらも表示)';
        default: return `${mode} (不明なモード、ISBNをスキップとして処理)`;
        }
    };

    const cleanupOldNotifications = () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - CONFIG.NEW_RELEASE_DAYS);
        cleanupOldStorageItems(CONFIG.LOCAL_STORAGE_KEYS.NOTIFICATIONS, cutoffDate, 'releaseDate');
    };

    const fetchAuthors = () => {
        return fetchJsonFromS3(CONFIG.AUTHORS_URL, 'authors');
    };

    const fetchExcludedKeywords = () => {
        return fetchJsonFromS3(CONFIG.EXCLUDED_KEYWORDS_URL, 'excluded keywords');
    };

    const checkPagesInBatches = async (authors, excludedKeywords, isbnMode) => {
        console.log(`📚 ${authors.length}人の作者の新刊をチェック開始...`);

        let newReleaseCount = 0;
        let processedCount = 0;

        for (let i = 0; i < authors.length; i += CONFIG.CONCURRENT_REQUESTS) {
            const batch = authors.slice(i, i + CONFIG.CONCURRENT_REQUESTS);

            const promises = batch.map(async (authorInfo) => {
                try {
                    // 除外キーワードとISBNモードを渡す
                    authorInfo.excludedKeywords = excludedKeywords;
                    authorInfo.isbnMode = isbnMode;
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

        const now = new Date().toLocaleString('ja-JP');
        console.log(`✅ チェック完了: ${newReleaseCount}冊の新刊を発見しました (${now})`);

        // 完了通知
        sendCompletionNotification('新刊チェック', authors.length, newReleaseCount);
    };

    const fetchAuthorSearchInfo = async (authorInfo) => {
        return new Promise((resolve, reject) => {
            // 作者名でKindleマンガを検索するURL
            const searchUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(authorInfo.Name)}&i=digital-text&rh=n%3A2250738051&s=date-desc-rank`;

            console.log(`🔍 検索中: ${authorInfo.Name}`);
            console.log(`📄 検索URL: ${searchUrl}`);

            GM_xmlhttpRequest({
                method: 'GET',
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

    const extractSearchPageInfo = async (doc, authorInfo, excludedKeywords) => {
        const searchResults = doc.querySelectorAll('[data-component-type="s-search-result"]');
        const newReleases = [];
        const currentDate = new Date();
        const cutoffDate = new Date(currentDate.getTime() - (CONFIG.NEW_RELEASE_DAYS * 24 * 60 * 60 * 1000));
        const isbnMode = authorInfo.isbnMode || 0;

        console.log(`🔍 検索結果: ${searchResults.length}件`);
        console.log(`📅 新刊判定基準日: ${cutoffDate.toISOString()}`);

        // 最初の数冊のみチェック（検索結果は日付順でソートされている）
        const booksToCheck = Array.from(searchResults).slice(0, 10);
        console.log(`📚 チェック対象: ${booksToCheck.length}冊`);

        for (let i = 0; i < booksToCheck.length; i++) {
            const item = booksToCheck[i];
            console.log(`\n📖 書籍 ${i + 1}/${booksToCheck.length} をチェック中...`);

            // 基本情報チェック
            const basicInfo = checkBookBasicInfo(item);
            if (!basicInfo.isValid) {
                console.log('⏭️ スキップ: タイトルまたはURLが見つかりません');
                // デバッグ用：利用可能な要素を表示
                const allH2 = item.querySelectorAll('h2, h2 span, h2 a, h2 a span');
                console.log(`🔍 利用可能なh2要素: ${allH2.length}個`);
                allH2.forEach((el, idx) => {
                    console.log(`  ${idx}: "${el.innerText?.trim() || ''}" (${el.tagName})`);
                });
                continue;
            }

            const { title, bookUrl } = basicInfo;
            const asin = extractAsinFromUrl(bookUrl);

            // ISBNフィルタリングチェック
            if (checkISBNFiltering(asin, isbnMode)) {
                continue;
            }

            // 通知済みチェック
            if (checkAlreadyNotified(asin)) {
                continue;
            }

            // 除外キーワードチェック
            if (checkExcludedKeywords(title, excludedKeywords)) {
                continue;
            }

            // 価格チェック
            const priceInfo = checkBookPrice(item);
            if (priceInfo.shouldSkip) {
                continue;
            }

            // 作者マッチチェック
            if (!checkAuthorMatch(item, authorInfo)) {
                continue;
            }

            // 発売日チェック
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
                console.log('✅ 新刊として追加しました');
            } else if (!dateInfo.releaseDate) {
                console.log('❌ 発売日を解析できませんでした');
            }
        }

        console.log(`\n📊 ${authorInfo.Name}の結果: ${newReleases.length}冊の新刊を発見`);
        return {
            ...authorInfo,
            newReleases
        };
    };

    const checkBookBasicInfo = (item) => {
        const titleElement = item.querySelector('.s-title-instructions-style a h2 span');
        const title = titleElement?.innerText?.trim() || '';
        const linkElement = titleElement?.closest('a') || item.querySelector('h2 a, .a-link-normal[href*="/dp/"]');
        const bookUrl = linkElement?.href || '';

        if (title && bookUrl) {
            console.log(`✅ タイトル取得成功: "${title}"`);
        }

        console.log(`📚 タイトル: "${title}"`);
        console.log(`🔗 URL: ${bookUrl}`);

        return { title, bookUrl, isValid: !!(title && bookUrl) };
    };

    const checkISBNFiltering = (asin, isbnMode) => {
        const isBookISBN = isISBN(asin);

        console.log(`📚 ASIN: ${asin}, ISBN判定: ${isBookISBN}, モード: ${isbnMode}`);

        switch (isbnMode) {
        case 0: // ISBNをスキップ
            if (isBookISBN) {
                console.log(`⏭️ スキップ: ISBN（紙書籍）のためスキップします (ASIN: ${asin})`);
                return true;
            }
            break;
        case 1: // ISBNのみ表示
            if (!isBookISBN) {
                console.log(`⏭️ スキップ: ISBNではないためスキップします (ASIN: ${asin})`);
                return true;
            }
            break;
        case 2: // どちらも表示
            // フィルタリングしない
            break;
        default: // 不明なモードの場合はISBNをスキップ
            if (isBookISBN) {
                console.log(`⏭️ スキップ: 不明なモード、ISBN（紙書籍）のためスキップします (ASIN: ${asin})`);
                return true;
            }
            break;
        }

        return false;
    };

    const checkAlreadyNotified = (asin) => {
        if (asin && isAlreadyStored(CONFIG.LOCAL_STORAGE_KEYS.NOTIFICATIONS, item => item.asin === asin)) {
            console.log(`⏭️ スキップ: 既に通知済みです (ASIN: ${asin})`);
            return true;
        }
        return false;
    };

    const checkExcludedKeywords = (title, excludedKeywords) => {
        const hasExcludedKeyword = excludedKeywords.some(keyword => title.includes(keyword));
        if (hasExcludedKeyword) {
            const matchedKeyword = excludedKeywords.find(keyword => title.includes(keyword));
            console.log(`⏭️ スキップ: 除外キーワード "${matchedKeyword}" が含まれています`);
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
                console.log(`💰 価格: ${price}円`);

                if (price <= CONFIG.MIN_PRICE) {
                    console.log(`⏭️ スキップ: 価格が${CONFIG.MIN_PRICE}円以下です (${price}円)`);
                    return { price, shouldSkip: true };
                }
            } else {
                console.log(`💰 価格: テキスト解析失敗 "${priceText}"`);
            }
        } else {
            console.log('💰 価格: 取得できませんでした（継続）');
        }

        return { price, shouldSkip: false };
    };

    const checkAuthorMatch = (item, authorInfo) => {
        const authorElement = item.querySelector('.a-size-base');
        const authorText = authorElement?.innerText?.trim() || '';
        const isAuthorMatch = authorText.includes(authorInfo.Name);

        console.log(`👤 作者情報: "${authorText}"`);
        console.log(`✅ 作者マッチ: ${isAuthorMatch}`);

        if (!isAuthorMatch) {
            console.log('⏭️ スキップ: 作者が一致しません');
            return false;
        }
        return true;
    };

    const checkReleaseDate = (item, cutoffDate) => {
        const dateElement = item.querySelector('.puis-desktop-list-row .puisg-col-4-of-24 div:nth-child(2) div:nth-child(2) span span');
        const releaseDateText = dateElement?.innerText?.trim() || '';

        console.log(`📅 発売日テキスト: "${releaseDateText}"`);

        const releaseDate = parseDateFromText(releaseDateText);

        if (releaseDate) {
            const isNewRelease = releaseDate > cutoffDate;

            console.log(`📅 発売日: ${releaseDate.toISOString()}`);
            console.log(`🆕 新刊判定: ${isNewRelease}`);

            return { releaseDate, isNewRelease };
        } else {
            console.log('❌ 発売日を解析できませんでした');
            return { releaseDate: null, isNewRelease: false };
        }
    };

    // Amazon固有の日本語日付解析関数（新刊チェッカー専用）
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
        console.log('❌ 日付パターンが見つかりません');
        return null;
    };

    const checkNewReleaseConditions = (info) => {
        return info.newReleases && info.newReleases.length > 0;
    };

    const sendNewReleaseNotification = (info) => {
        info.newReleases.forEach(book => {
            // 通知を送信
            GM_notification({
                title: `📚 ${info.Name}の新刊発見`,
                text: `${book.title}`,
                image: 'https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp',
                timeout: 0,
                onclick: () => {
                    GM_openInTab(book.url, { active: true });
                }
            });

            // 通知済みアイテムとして保存
            if (book.asin) {
                saveNotifiedItem(book.asin, book.releaseDate, book.title, book.author);
            }
        });
    };

    const saveNotifiedItem = (asin, releaseDate, title, author) => {
        const newItem = {
            asin,
            releaseDate,
            title,
            author,
            notifiedAt: new Date().toISOString()
        };
        saveStorageItem(CONFIG.LOCAL_STORAGE_KEYS.NOTIFICATIONS, newItem);
    };

    // グローバル関数として公開（デベロッパーツールから呼び出し可能）
    unsafeWindow.checkNewReleases = checkNewReleases;

    console.log('🚀 New Release Checker が読み込まれました');
    console.log('💡 デベロッパーツールで checkNewReleases(isbnMode) を実行してください');
    console.log('💡 isbnMode: 0=ISBNスキップ(デフォルト), 1=ISBNのみ, 2=どちらも表示');
})();