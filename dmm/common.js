// DMM共通ライブラリ
unsafeWindow.DMMCommon = (function () {
    'use strict';

    // DOM監視
    const observeDOM = (callback, options = { childList: true, subtree: true }) => {
        const observer = new MutationObserver(callback);
        observer.observe(document.body, options);
        return observer;
    };

    // リンクの属性変更
    const modifyLink = (link, url) => {
        link.removeAttribute('onclick');
        link.setAttribute('href', url);
        link.setAttribute('target', '_blank');
        link.style.cursor = 'pointer';
    };

    // onclick属性からURLを抽出
    const extractUrlFromOnclick = (onclickAttr) => {
        const match = onclickAttr.match(/window\.open\('([^']+)'/);
        return match ? match[1] : null;
    };

    // 処理済みマーク
    const markAsProcessed = (element, marker = 'modified') => {
        element.dataset[marker] = 'true';
    };

    // 処理済みかチェック
    const isProcessed = (element, marker = 'modified') => {
        return element.dataset[marker] === 'true';
    };

    // 公開API
    return {
        observeDOM,
        modifyLink,
        extractUrlFromOnclick,
        markAsProcessed,
        isProcessed
    };
})();