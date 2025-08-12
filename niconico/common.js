// ニコニコ動画共通ライブラリ
unsafeWindow.NiconicoCommon = (function () {
    "use strict";

    // 通知表示
    const showNotification = (title, text, timeout = 3000) => {
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                title,
                text,
                timeout
            });
        } else {
            console.log(`[${title}] ${text}`);
        }
    };

    // 待機関数
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 要素へのスクロール
    const scrollToElement = async (element) => {
        element.scrollIntoView({ behavior: 'auto', block: 'center' });
        await wait(100);
    };

    // SVGボタン作成
    const createSVGButton = (pathData, className = 'original-control-button') => {
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgElement.setAttribute('width', '24');
        svgElement.setAttribute('height', '24');
        svgElement.setAttribute('viewBox', '0 0 24 24');

        const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElement.setAttribute('d', pathData);
        pathElement.setAttribute('fill', 'white');

        svgElement.appendChild(pathElement);

        const buttonElement = document.createElement('button');
        buttonElement.className = className;
        buttonElement.style.cursor = 'pointer';
        buttonElement.appendChild(svgElement);

        return { button: buttonElement, svg: svgElement };
    };

    // デバウンス関数
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // DOM監視
    const observeDOM = (callback, options = { childList: true, subtree: true }) => {
        const observer = new MutationObserver(callback);
        observer.observe(document.body, options);
        return observer;
    };

    // キャンバス操作
    const createCanvas = (width, height) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };

    // スタイル適用
    const applyStyles = (element, styles) => {
        Object.assign(element.style, styles);
    };

    // ビデオID抽出
    const extractVideoId = (url) => {
        const match = url?.match(/(sm\d+)/);
        return match ? match[0] : null;
    };

    // 公開API
    return {
        showNotification,
        wait,
        scrollToElement,
        createSVGButton,
        debounce,
        observeDOM,
        createCanvas,
        applyStyles,
        extractVideoId
    };
})();