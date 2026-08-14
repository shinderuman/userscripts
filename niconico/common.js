unsafeWindow.NiconicoCommon = (function () {
    'use strict';

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

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const scrollToElement = async (element) => {
        element.scrollIntoView({ behavior: 'auto', block: 'center' });
        await wait(100);
    };

    const createSVGButton = (
        pathData,
        className = 'original-control-button'
    ) => {
        const svgElement = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg'
        );
        svgElement.setAttribute('width', '24');
        svgElement.setAttribute('height', '24');
        svgElement.setAttribute('viewBox', '0 0 24 24');

        const pathElement = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
        );
        pathElement.setAttribute('d', pathData);
        pathElement.setAttribute('fill', 'white');

        svgElement.appendChild(pathElement);

        const buttonElement = document.createElement('button');
        buttonElement.className = className;
        buttonElement.style.cursor = 'pointer';
        buttonElement.appendChild(svgElement);

        return { button: buttonElement, svg: svgElement };
    };

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

    const observeDOM = (
        callback,
        options = { childList: true, subtree: true }
    ) => {
        const observer = new MutationObserver(callback);
        observer.observe(document.body, options);
        return observer;
    };

    const createCanvas = (width, height) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };

    const applyStyles = (element, styles) => {
        Object.assign(element.style, styles);
    };

    const extractVideoId = (url) => {
        const match = url?.match(/(sm\d+)/);
        return match ? match[0] : null;
    };

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
