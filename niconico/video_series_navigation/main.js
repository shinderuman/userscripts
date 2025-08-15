(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        createSVGButton,
        extractVideoId
    } = unsafeWindow.NiconicoCommon;

    const CONFIG = {
        SVG_PATHS: {
            FIRST: 'M12 4l-8 8 8 8V4M22 4l-8 8 8 8V4',
            PREVIOUS: 'M12 4l-8 8 8 8V4zm10 0v16h-2V4h2z',
            NEXT: 'M12 4l8 8-8 8V4zm-8 0h2v16H4V4z',
            FORWARD: 'M19.6 6.95a9.11 9.11 0 1 0-1.12 11.46.96.96 0 0 1 1.36 0l.69.68c.37.37.37.97 0 1.35a12 12 0 1 1 1.53-14.96l.49-.3a.96.96 0 0 1 1.45.83v4.37a.96.96 0 0 1-1.42.85l-3.48-1.9-.34-.19a.96.96 0 0 1-.04-1.66z',
            REWIND: 'M4.4 6.95a9.11 9.11 0 1 1 1.12 11.46.96.96 0 0 0-1.36 0l-.69.68a.96.96 0 0 0 0 1.35A12 12 0 1 0 1.93 5.48l-.49-.3A.96.96 0 0 0 0 6.02v4.37a.96.96 0 0 0 1.42.85l3.82-2.09a.96.96 0 0 0 .04-1.66z'
        },
        TIME_OFFSETS: [-60, 60],
        SELECTORS: {
            PLAYER_CONTAINER: 'div.pos_relative.asp_auto.w_100\\%.ov_hidden.bdr_m',
            SERIES_SECTION: 'div.grid-area_\\[bottom\\].d_flex.flex-d_column.gap_x2',
            SERIES_LINKS: 'div.grid-area_\\[sidebar\\] > div.d_flex.flex-d_column.gap_x2 > section > div > div > div > div > div > a',
            BUTTON_PAUSE: '#tooltip\\:«r6»\\:trigger',
            BUTTON_FORWARD: '#tooltip\\:«r9»\\:trigger',
            BUTTON_REWIND: '#tooltip\\:«ra»\\:trigger',
            ANCHORS: {
                FIRST: 'a[data-anchor-detail="first"]',
                PREVIOUS: 'a[data-anchor-detail="prev"]',
                NEXT: 'a[data-anchor-detail="next"]'
            }
        }
    };

    let isProcessing = false;
    let debounceTimeout = null;

    const createButton = (pathData, link = null, timeOffset = 0) => {
        const { button, svg } = createSVGButton(pathData);
        button.classList.add('original-control-button');

        if (link) {
            button.title = link.querySelector('div.ml_base > h2')?.innerText ?? link.text;
            button.onclick = () => {
                window.location.href = link.href;
            };
        }

        if (timeOffset) {
            const absTimeOffset = Math.abs(timeOffset);
            button.title = `${absTimeOffset}秒${timeOffset > 0 ? '送る' : '戻る'}`;
            button.onclick = () => {
                const video = document.querySelector('video');
                if (video) {
                    video.currentTime += timeOffset;
                }
            };

            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', '12');
            textElement.setAttribute('y', '15');
            textElement.setAttribute('font-size', '8');
            textElement.setAttribute('text-anchor', 'middle');
            textElement.setAttribute('fill', 'white');
            textElement.setAttribute('font-weight', 'bold');
            textElement.textContent = absTimeOffset;

            svg.appendChild(textElement);
        }

        return button;
    };

    const createNavigationButtons = (playerContainer, navigationLinks) => {
        removeNavigationButtons();

        const buttonRewind = document.querySelector(CONFIG.SELECTORS.BUTTON_FORWARD);
        const buttonForward = document.querySelector(CONFIG.SELECTORS.BUTTON_REWIND);

        if (navigationLinks.first) {
            buttonRewind.parentNode.insertBefore(createButton(CONFIG.SVG_PATHS.FIRST, navigationLinks.first), buttonRewind);
        }

        if (navigationLinks.previous) {
            buttonRewind.parentNode.insertBefore(createButton(CONFIG.SVG_PATHS.PREVIOUS, navigationLinks.previous), buttonRewind);
        }

        if (navigationLinks.next) {
            buttonForward.parentNode.insertBefore(createButton(CONFIG.SVG_PATHS.NEXT, navigationLinks.next), buttonForward.nextSibling);
        }

        const sortedOffsets = [
            ...CONFIG.TIME_OFFSETS.filter(time => time < 0).sort((a, b) => a - b),
            ...CONFIG.TIME_OFFSETS.filter(time => time > 0).sort((a, b) => b - a)
        ];

        sortedOffsets.forEach(time => {
            if (time < 0) {
                buttonRewind.parentNode.insertBefore(createButton(CONFIG.SVG_PATHS.REWIND, null, time), buttonRewind);
            } else {
                buttonForward.parentNode.insertBefore(createButton(CONFIG.SVG_PATHS.FORWARD, null, time), buttonForward.nextSibling);
            }
        });
    };

    const removeNavigationButtons = () => {
        document.querySelectorAll('.original-control-button').forEach(button => button.remove());
    };

    const fetchSeriesLinks = () => {
        const videoLinks = document.querySelectorAll(CONFIG.SELECTORS.SERIES_LINKS);
        const currentVideoIndex = Array.from(videoLinks).findIndex(el => el.getAttribute('data-playing') === 'true');

        const previousLink = document.querySelector(CONFIG.SELECTORS.ANCHORS.PREVIOUS);
        const nextLink = document.querySelector(CONFIG.SELECTORS.ANCHORS.NEXT);
        const firstLink = previousLink ? document.querySelector(CONFIG.SELECTORS.ANCHORS.FIRST) : null;

        if (currentVideoIndex === -1) {
            return {
                first: firstLink,
                previous: previousLink,
                next: nextLink
            };
        }

        const previousVideoId = currentVideoIndex > 0 ? extractVideoId(videoLinks[currentVideoIndex - 1]) : null;
        const nextVideoId = currentVideoIndex < videoLinks.length - 1 ? extractVideoId(videoLinks[currentVideoIndex + 1]) : null;
        const previousAnchorId = previousLink ? extractVideoId(previousLink) : null;
        const nextAnchorId = nextLink ? extractVideoId(nextLink) : null;

        return {
            first: previousVideoId === previousAnchorId && nextVideoId === nextAnchorId ? firstLink : null,
            previous: currentVideoIndex > 0 ? videoLinks[currentVideoIndex - 1] : null,
            next: currentVideoIndex < videoLinks.length - 1 ? videoLinks[currentVideoIndex + 1] : null
        };
    };

    const processButtons = () => {
        if (isProcessing) return;
        isProcessing = true;

        try {
            const playerContainer = document.querySelector(CONFIG.SELECTORS.PLAYER_CONTAINER);
            if (playerContainer) {
                if (document.querySelector(`${CONFIG.SELECTORS.SERIES_SECTION} > div.bdr_m.ov_hidden, ${CONFIG.SELECTORS.SERIES_LINKS}`)) {
                    const navigationLinks = fetchSeriesLinks();
                    if (navigationLinks.previous || navigationLinks.next) {
                        createNavigationButtons(playerContainer, navigationLinks);
                    }
                }
            } else {
                removeNavigationButtons();
            }
        } finally {
            isProcessing = false;
        }
    };

    const debouncedProcessButtons = () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(processButtons, 100);
    };

    const monitorSeriesSection = () => {
        let seriesSectionObserver = null;

        const mainObserver = new MutationObserver((mutations) => {
            // 自分が追加したボタンの変更は無視
            const hasRelevantChanges = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    !node.classList?.contains('original-control-button')
                ) || Array.from(mutation.removedNodes).some(node =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    !node.classList?.contains('original-control-button')
                );
            });

            if (!hasRelevantChanges) return;

            const seriesSection = document.querySelector(CONFIG.SELECTORS.SERIES_SECTION);
            if (seriesSection) {
                if (!seriesSectionObserver) {
                    seriesSectionObserver = new MutationObserver((mutations) => {
                        // 自分が追加したボタンの変更は無視
                        const hasRelevantChanges = mutations.some(mutation => {
                            return Array.from(mutation.addedNodes).some(node =>
                                node.nodeType === Node.ELEMENT_NODE &&
                                !node.classList?.contains('original-control-button')
                            ) || Array.from(mutation.removedNodes).some(node =>
                                node.nodeType === Node.ELEMENT_NODE &&
                                !node.classList?.contains('original-control-button')
                            );
                        });

                        if (hasRelevantChanges) {
                            debouncedProcessButtons();
                        }
                    });

                    seriesSectionObserver.observe(seriesSection, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        characterData: true
                    });
                }
                debouncedProcessButtons();
            } else if (seriesSectionObserver) {
                seriesSectionObserver.disconnect();
                seriesSectionObserver = null;
            }
        });

        mainObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    };

    const initializeSeriesVideoNavigator = () => {
        monitorSeriesSection();
        console.log('🚀 ニコニコ動画シリーズナビゲーターが初期化されました');
    };

    // グローバル関数として公開
    unsafeWindow.initializeSeriesVideoNavigator = initializeSeriesVideoNavigator;

    // 自動初期化
    initializeSeriesVideoNavigator();
})();