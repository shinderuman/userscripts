(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        showNotification,
        scrollToElement,
        createCanvas,
        applyStyles
    } = unsafeWindow.NiconicoCommon;

    const CONFIG = {
        SELECTORS: {
            PAGE_CONTENTS: 'ul#page_contents > li',
            PREV_LINK: 'p.prev > a:not(.disabled)',
            NEXT_LINK: 'p.next > a:not(.disabled)'
        },
        KEY_MAPPING: {
            PREV_PAGE: ['ArrowRight', 'ArrowUp', 'x'],
            NEXT_PAGE: ['ArrowLeft', 'ArrowDown', 'z']
        },
        STYLES: {
            CONTAINER: {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: '9999'
            },
            NAVIGATION_LINK: {
                position: 'fixed',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'auto',
                color: 'white',
                background: 'rgba(0,0,0,0.5)',
                padding: '8px 12px',
                fontSize: '16px',
                textDecoration: 'none',
                borderRadius: '8px'
            },
            BODY: {
                margin: '0',
                backgroundColor: 'black'
            },
            CANVAS: {
                display: 'block',
                height: '100vh',
                width: 'auto',
                margin: '0 auto'
            }
        }
    };

    let abort = false;
    let prevEpisodeURL = null;
    let nextEpisodeURL = null;

    const collectPageCanvases = async () => {
        const liElements = document.querySelectorAll(CONFIG.SELECTORS.PAGE_CONTENTS);
        const pages = [];

        for (const li of liElements) {
            if (abort) {
                showNotification('横読み変換', 'ESC キーにより処理を中断しました');
                return [];
            }
            await scrollToElement(li);

            const canvases = li.querySelectorAll('canvas');
            const isSpread = li.classList.contains('spread');

            if (isSpread && canvases.length >= 2) {
                pages.push({ canvases: [canvases[1], canvases[0]], isSpread: true });
            } else if (canvases.length >= 1) {
                pages.push({ canvases: [canvases[0]], isSpread: false });
            }
        }

        return pages;
    };

    const enablePageTurn = (canvas, pageGroups) => {
        const displayUnits = [];

        for (let i = 0; i < pageGroups.length;) {
            const page = pageGroups[i];
            if (page.isSpread) {
                displayUnits.push([page]);
                i += 1;
            } else {
                const next = pageGroups[i + 1];
                if (next && !next.isSpread) {
                    displayUnits.push([page, next]);
                    i += 2;
                } else {
                    displayUnits.push([page]);
                    i += 1;
                }
            }
        }

        let currentUnit = 0;

        const render = () => {
            const pages = displayUnits[currentUnit];
            const totalWidth = pages.reduce((sum, p) =>
                sum + p.canvases.reduce((w, c) => w + c.width, 0), 0);
            const maxHeight = Math.max(...pages.flatMap(p => p.canvases.map(c => c.height)));

            canvas.width = totalWidth;
            canvas.height = maxHeight;
            const ctx = canvas.getContext('2d');

            let offsetX = totalWidth;
            for (const p of pages) {
                const drawOrder = p.isSpread ? p.canvases : [...p.canvases].reverse();
                for (const c of drawOrder) {
                    offsetX -= c.width;
                    ctx.drawImage(c, offsetX, 0);
                }
            }
        };

        const handleKeydown = e => {
            if (CONFIG.KEY_MAPPING.PREV_PAGE.includes(e.key)) {
                if (currentUnit > 0) {
                    currentUnit--;
                    render();
                } else if (prevEpisodeURL) {
                    window.location.href = prevEpisodeURL;
                }
            } else if (CONFIG.KEY_MAPPING.NEXT_PAGE.includes(e.key)) {
                if (currentUnit + 1 < displayUnits.length) {
                    currentUnit++;
                    render();
                } else if (nextEpisodeURL) {
                    window.location.href = nextEpisodeURL;
                }
            }
        };

        render();
        document.addEventListener('keydown', handleKeydown);
    };

    const createNavigationLinks = () => {
        const container = document.createElement('div');
        applyStyles(container, CONFIG.STYLES.CONTAINER);

        const createSideLink = (selector, label, side) => {
            const link = document.querySelector(selector);
            if (!link) return;

            const a = document.createElement('a');
            a.href = link.href;
            a.textContent = label;
            applyStyles(a, {
                ...CONFIG.STYLES.NAVIGATION_LINK,
                [side]: '10px'
            });

            container.appendChild(a);
        };

        createSideLink(CONFIG.SELECTORS.PREV_LINK, '前のエピソード →', 'right');
        createSideLink(CONFIG.SELECTORS.NEXT_LINK, '← 次のエピソード', 'left');

        return container;
    };

    const initializeDisplay = (canvas, nav) => {
        document.body.innerHTML = '';
        applyStyles(document.body, CONFIG.STYLES.BODY);
        applyStyles(canvas, CONFIG.STYLES.CANVAS);
        document.body.append(canvas, nav);
    };

    const handleAbortKey = e => {
        if (e.key === 'Escape') {
            abort = true;
            console.log('[横読み変換] 処理が中断されました（ESC キー）。');
        }
    };

    const initializeMangaReader = async () => {
        const prevLink = document.querySelector(CONFIG.SELECTORS.PREV_LINK);
        const nextLink = document.querySelector(CONFIG.SELECTORS.NEXT_LINK);

        if (prevLink) prevEpisodeURL = prevLink.href;
        if (nextLink) nextEpisodeURL = nextLink.href;

        const pageGroups = await collectPageCanvases();
        if (!pageGroups.length) {
            return;
        }

        const canvas = createCanvas(800, 600);
        const nav = createNavigationLinks();

        initializeDisplay(canvas, nav);
        enablePageTurn(canvas, pageGroups);

        console.log('📖 ニコニコ漫画横読み変換が初期化されました');
    };

    // イベントリスナー設定
    document.addEventListener('keydown', handleAbortKey);
    setTimeout(initializeMangaReader, 1000);
})();