unsafeWindow.YouTubeCommon = (function () {
    'use strict';

    const observeDOM = (
        callback,
        options = { childList: true, subtree: true }
    ) => {
        const observer = new MutationObserver(callback);
        const target = document.querySelector('ytd-app') || document.body;
        observer.observe(target, options);
        return observer;
    };

    const setCSSVariable = (element, variable, value) => {
        element?.style.setProperty(variable, value);
    };

    const removeElements = (selector) => {
        document
            .querySelectorAll(selector)
            .forEach((element) => element.remove());
    };

    const hideElements = (selector) => {
        document.querySelectorAll(selector).forEach((element) => {
            element.style.display = 'none';
        });
    };

    const filterElementsByText = (selector, textFilter) => {
        return Array.from(document.querySelectorAll(selector)).filter(
            (element) => textFilter(element.textContent)
        );
    };

    const setGridColumns = (columnCount) => {
        const gridRenderer = document.querySelector('ytd-rich-grid-renderer');
        setCSSVariable(
            gridRenderer,
            '--ytd-rich-grid-items-per-row',
            columnCount
        );
    };

    const removePastStreams = () => {
        filterElementsByText(
            'span.inline-metadata-item.style-scope.ytd-video-meta-block',
            (text) => text.includes('配信済み')
        ).forEach((span) => {
            span.closest('ytd-rich-item-renderer')?.remove();
        });
    };

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
