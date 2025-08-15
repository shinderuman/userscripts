// Amazon共通ライブラリ
unsafeWindow.AmazonCommon = (function () {
    'use strict';

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

    // 要素の監視（コールバック付き）
    const observeElement = (selector, callback) => {
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                callback(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    };

    // スタイル適用ユーティリティ
    const applyStyles = (element, styleObj) => {
        Object.entries(styleObj).forEach(([key, value]) => {
            element.style[key] = value;
        });
    };

    // 価格解析ユーティリティ
    const parsePrice = (priceText) => {
        if (!priceText) return 0;
        const match = priceText.match(/[\d,]+/);
        return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
    };

    // URL操作ユーティリティ（ハッシュタグ保持）
    const addUrlParams = (url, params) => {
        try {
            const urlObj = new URL(url);
            Object.entries(params).forEach(([key, value]) => {
                urlObj.searchParams.set(key, value);
            });
            // new URL()はハッシュタグを自動的に保持するので、そのまま返す
            return urlObj.href;
        } catch (error) {
            console.error('URL parsing error:', error);
            return url; // エラー時は元のURLを返す
        }
    };

    // Amazon URL判定
    const isAmazonUrl = (url) => {
        return /https?:\/\/(amzn\.asia|www\.amazon\.[a-z.]+)\//.test(url);
    };

    // ページ取得ユーティリティ
    const fetchPage = async (url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();
            const parser = new DOMParser();
            return parser.parseFromString(html, 'text/html');
        } catch (error) {
            console.error('Page fetch error:', error);
            throw error;
        }
    };

    // ファビコン操作
    const changeFavicon = (url) => {
        let link = document.querySelector('link[rel*=\'icon\'], link[rel=\'shortcut icon\']');
        if (!link) {
            link = document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            document.head.appendChild(link);
        }
        link.href = url;
    };

    // ファビコンにバッジ追加
    const addBadgeToFavicon = (color) => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.src = document.querySelector('link[rel*=\'icon\'], link[rel=\'shortcut icon\']')?.href || 'https://www.amazon.co.jp/favicon.ico';
        img.onload = () => {
            ctx.drawImage(img, 0, 0, 32, 32);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(24, 8, 8, 0, 2 * Math.PI);
            ctx.fill();

            const newFavicon = canvas.toDataURL('image/png');
            changeFavicon(newFavicon);
        };
    };

    // 公開API
    return {
        waitForElement,
        observeElement,
        applyStyles,
        parsePrice,
        addUrlParams,
        isAmazonUrl,
        fetchPage,
        changeFavicon,
        addBadgeToFavicon
    };
})();