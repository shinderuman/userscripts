unsafeWindow.AmazonCommon = (function () {
    'use strict';

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
                reject(
                    new Error(
                        `Element ${selector} not found within ${timeout}ms`
                    )
                );
            }, timeout);
        });
    };

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

    const applyStyles = (element, styleObj) => {
        Object.entries(styleObj).forEach(([key, value]) => {
            element.style[key] = value;
        });
    };

    const parsePrice = (priceText) => {
        if (!priceText) return 0;
        const match = priceText.match(/[\d,]+/);
        return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
    };

    const addUrlParams = (url, params) => {
        try {
            const urlObj = new URL(url);
            Object.entries(params).forEach(([key, value]) => {
                urlObj.searchParams.set(key, value);
            });
            return urlObj.href;
        } catch (error) {
            console.error('URL parsing error:', error);
            return url;
        }
    };

    const isAmazonUrl = (url) => {
        return /https?:\/\/(amzn\.asia|www\.amazon\.[a-z.]+)\//.test(url);
    };

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

    const changeFavicon = (url) => {
        let link = document.querySelector(
            "link[rel*='icon'], link[rel='shortcut icon']"
        );
        if (!link) {
            link = document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            document.head.appendChild(link);
        }
        link.href = url;
    };

    const addBadgeToFavicon = (color) => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.src =
            document.querySelector(
                "link[rel*='icon'], link[rel='shortcut icon']"
            )?.href || 'https://www.amazon.co.jp/favicon.ico';
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
