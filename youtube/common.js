// YouTube共通ライブラリ
unsafeWindow.YouTubeCommon = (function () {
    "use strict";

    // DOM監視
    const observeDOM = (callback, options = { childList: true, subtree: true }) => {
        const observer = new MutationObserver(callback);
        const target = document.querySelector('ytd-app') || document.body;
        observer.observe(target, options);
        return observer;
    };

    // CSS変数設定
    const setCSSVariable = (element, variable, value) => {
        element?.style.setProperty(variable, value);
    };

    // 要素の削除
    const removeElements = (selector) => {
        document.querySelectorAll(selector).forEach(element => element.remove());
    };

    // 要素の非表示
    const hideElements = (selector) => {
        document.querySelectorAll(selector).forEach(element => {
            element.style.display = 'none';
        });
    };

    // テキスト内容による要素フィルタリング
    const filterElementsByText = (selector, textFilter) => {
        return Array.from(document.querySelectorAll(selector))
            .filter(element => textFilter(element.textContent));
    };

    // グリッド列数設定
    const setGridColumns = (columnCount) => {
        const gridRenderer = document.querySelector('ytd-rich-grid-renderer');
        setCSSVariable(gridRenderer, '--ytd-rich-grid-items-per-row', columnCount);
    };

    // 配信済み動画の削除
    const removePastStreams = () => {
        filterElementsByText('span.inline-metadata-item.style-scope.ytd-video-meta-block', 
            text => text.includes('配信済み')
        ).forEach(span => {
            span.closest('ytd-rich-item-renderer')?.remove();
        });
    };

    // 公開API
    return {
        observeDOM,
        setCSSVariable,
        removeElements,
        hideElements,
        filterElementsByText,
        setGridColumns,
        removePastStreams
    };
})();