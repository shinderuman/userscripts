unsafeWindow.DMMCommon = (function () {
    'use strict';

    const observeDOM = (
        callback,
        options = { childList: true, subtree: true }
    ) => {
        const observer = new MutationObserver(callback);
        observer.observe(document.body, options);
        return observer;
    };

    const modifyLink = (link, url) => {
        link.removeAttribute('onclick');
        link.setAttribute('href', url);
        link.setAttribute('target', '_blank');
        link.style.cursor = 'pointer';
    };

    const extractUrlFromOnclick = (onclickAttr) => {
        const match = onclickAttr.match(/window\.open\('([^']+)'/);
        return match ? match[1] : null;
    };

    const markAsProcessed = (element, marker = 'modified') => {
        element.dataset[marker] = 'true';
    };

    const isProcessed = (element, marker = 'modified') => {
        return element.dataset[marker] === 'true';
    };

    return {
        observeDOM,
        modifyLink,
        extractUrlFromOnclick,
        markAsProcessed,
        isProcessed
    };
})();
