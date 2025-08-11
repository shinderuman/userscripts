// 共通ライブラリ
unsafeWindow.KindleCommon = (function () {
    "use strict";

    // S3からJSONデータを取得する共通関数
    const fetchJsonFromS3 = (url, dataType) => {
        return new Promise((resolve, reject) => {
            // キャッシュバスターを追加してキャッシュを無効化
            const cacheBuster = `?t=${Date.now()}&r=${Math.random()}`;
            const urlWithCacheBuster = url + cacheBuster;

            GM_xmlhttpRequest({
                method: "GET",
                url: urlWithCacheBuster,
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            console.log(`📥 S3データ取得成功: ${dataType} (${data.length || Object.keys(data).length}件)`);
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

    // 個別ページの情報を取得する共通関数
    const fetchPageInfo = (url, extractorFunction) => {
        return new Promise((resolve, reject) => {
            const cleanUrl = url.split('?')[0]; // アフィリエイトパラメータを除去

            GM_xmlhttpRequest({
                method: "GET",
                url: cleanUrl,
                onload: (response) => {
                    if (response.status === 200) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const info = extractorFunction(doc, cleanUrl);
                        resolve(info);
                    } else {
                        reject(new Error(`Failed to fetch page: ${response.status}`));
                    }
                },
                onerror: (error) => reject(error)
            });
        });
    };

    // バッチ処理の共通関数
    const processBatch = async (items, processorFunction, config) => {
        const { CONCURRENT_REQUESTS = 20, REQUEST_DELAY = 1000 } = config;

        console.log(`📚 ${items.length}件の処理を開始...`);

        let processedCount = 0;
        let resultCount = 0;

        for (let i = 0; i < items.length; i += CONCURRENT_REQUESTS) {
            const batch = items.slice(i, i + CONCURRENT_REQUESTS);

            const promises = batch.map(async (item) => {
                try {
                    const result = await processorFunction(item);
                    processedCount++;

                    if (result.success && result.shouldNotify) {
                        resultCount++;
                    }

                    return result;
                } catch (error) {
                    console.error(`❌ エラー: ${item.URL || item.Name || 'Unknown'}`, error);
                    return { success: false, error };
                }
            });

            await Promise.all(promises);

            // 次のバッチまで待機（レート制限対策）
            if (i + CONCURRENT_REQUESTS < items.length) {
                await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
            }
        }

        return { processedCount, resultCount };
    };

    // 通知送信の共通関数
    const sendNotification = (title, text, url, timeout = 0) => {
        GM_notification({
            title,
            text,
            image: "https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp",
            timeout,
            onclick: () => {
                if (url) {
                    GM_openInTab(url, { active: true });
                }
            }
        });
    };

    // 完了通知の共通関数
    const sendCompletionNotification = (scriptName, totalCount, resultCount) => {
        sendNotification(
            `📚 ${scriptName}完了`,
            `${totalCount}件中 ${resultCount}件を発見`,
            null,
            5000
        );
    };

    // エラー通知の共通関数
    const sendErrorNotification = (scriptName, errorMessage) => {
        sendNotification(
            "❌ エラー",
            `${scriptName}中にエラーが発生しました: ${errorMessage}`,
            null,
            5000
        );
    };

    // URLからASINを抽出
    const extractAsinFromUrl = (url) => {
        const match = url.match(/\/dp\/([A-Z0-9]{10})/);
        return match ? match[1] : null;
    };

    // 共通のDOM要素値取得関数
    const getElementValue = (doc, selector, regex) => {
        const element = doc.querySelector(selector);
        if (!element) return 0;
        const match = element.innerText.match(regex);
        return match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
    };

    // localStorage管理機能
    const getStorageItems = (storageKey) => {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch (error) {
            console.error('❌ localStorage読み込みエラー:', error);
            return [];
        }
    };

    const saveStorageItem = (storageKey, item) => {
        try {
            const items = getStorageItems(storageKey);
            items.push(item);
            localStorage.setItem(storageKey, JSON.stringify(items));
            console.log(`💾 アイテムを保存: ${item.asin || item.id || 'Unknown'}`);
        } catch (error) {
            console.error('❌ localStorage保存エラー:', error);
        }
    };

    const isAlreadyStored = (storageKey, checkFunction) => {
        const items = getStorageItems(storageKey);
        return items.some(checkFunction);
    };

    const cleanupOldStorageItems = (storageKey, cutoffDate, dateField = 'releaseDate') => {
        try {
            const items = getStorageItems(storageKey);
            const validItems = items.filter(item => {
                const itemDate = new Date(item[dateField]);
                return itemDate >= cutoffDate;
            });

            const removedCount = items.length - validItems.length;
            if (removedCount > 0) {
                localStorage.setItem(storageKey, JSON.stringify(validItems));
                console.log(`🧹 古い記録を${removedCount}件削除しました`);
            }
        } catch (error) {
            console.error('❌ localStorage清理エラー:', error);
        }
    };

    // 公開API
    return {
        fetchJsonFromS3,
        fetchPageInfo,
        processBatch,
        sendNotification,
        sendCompletionNotification,
        sendErrorNotification,
        extractAsinFromUrl,
        getElementValue,
        getStorageItems,
        saveStorageItem,
        isAlreadyStored,
        cleanupOldStorageItems
    };
})();