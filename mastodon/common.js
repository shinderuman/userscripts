// Mastodon共通ライブラリ
unsafeWindow.MastodonCommon = (function () {
    'use strict';

    // IndexedDBを使用した画像キャッシュクラス
    class ImageCache {
        constructor(dbName = 'ImageCacheDB', storeName = 'images', expirationTime = 24 * 60 * 60 * 1000 * 7) {
            this.dbName = dbName;
            this.storeName = storeName;
            this.expirationTime = expirationTime;
            this.deleteExpiredData().catch(error => {
                console.error('Error deleting expired data:', error);
            });
        }

        async openDatabase() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, 1);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'id' });
                    }
                };

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async getCachedData(id) {
            const db = await this.openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(id);

                request.onsuccess = () => resolve(request.result?.data);
                request.onerror = () => reject(request.error);
            });
        }

        async saveToIndexedDB(id, data) {
            const db = await this.openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put({ id, data, timestamp: Date.now() });

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        async deleteExpiredData() {
            const db = await this.openDatabase();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.openCursor();

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const record = cursor.value;
                        if (Date.now() - record.timestamp > this.expirationTime) {
                            store.delete(cursor.key);
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };

                request.onerror = () => reject(request.error);
            });
        }
    }

    // 遅延実行対応のMutationObserver
    class DeferredMutationObserver {
        constructor(callback) {
            this.observer = new MutationObserver((mutations) => {
                if (this.isTabActive) {
                    callback(mutations);
                } else {
                    this.deferredMutations.push(...mutations);
                }
            });

            this.deferredMutations = [];
            this.isTabActive = true;
            this.initVisibilityListener(callback);
        }

        observe(target, options) {
            this.observer.observe(target, options);
        }

        disconnect() {
            this.observer.disconnect();
        }

        initVisibilityListener(callback) {
            const handleVisibilityChange = () => {
                this.isTabActive = document.visibilityState === 'visible';
                if (this.isTabActive && this.deferredMutations.length > 0) {
                    setTimeout(() => {
                        callback(this.deferredMutations);
                    }, 500);
                    this.deferredMutations = [];
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
    }

    // DOM要素の待機と取得
    const waitForElement = (selector, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    };

    // 複数の要素を待機
    const waitForElements = (selectors, timeout = 10000) => {
        return Promise.all(selectors.map(selector => waitForElement(selector, timeout)));
    };

    // APIリクエスト共通関数
    const fetchAPI = async (url, options = {}) => {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API fetch error:', error);
            throw error;
        }
    };

    // ユーザー名取得
    const getCurrentUsername = () => {
        const profileLink = document.querySelector('a[href^="/web/@"]');
        if (profileLink) {
            const match = profileLink.href.match(/\/web\/@(.+)/);
            return match ? match[1] : null;
        }
        return null;
    };

    // 公開API
    return {
        ImageCache,
        DeferredMutationObserver,
        waitForElement,
        waitForElements,
        fetchAPI,
        getCurrentUsername
    };
})();