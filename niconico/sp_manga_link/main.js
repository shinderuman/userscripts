(function () {
    'use strict';

    const { observeDOM } = unsafeWindow.NiconicoCommon;

    const CONFIG = {
        SHORTCUT_SELECTOR: 'div.info_block.shortcut',
        FIRST_LINK_SELECTOR: 'a.first',
        LINK_MARKER: 'data-sp-manga-link',
        INDEX_LABEL: 'スマホ版で開く',
        EPISODE1_LABEL: 'スマホ版第１話から読む',
        FETCH_ERROR_LABEL: 'スマホ版第１話: 取得失敗',
        PC_HOST: 'manga.nicovideo.jp',
        SP_HOST: 'sp.manga.nicovideo.jp'
    };

    const fetchFinalUrl = (url) =>
        new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                redirect: 'follow',
                onload: (response) => {
                    resolve(response.finalUrl);
                },
                onerror: (error) => {
                    reject(error);
                },
                ontimeout: () => {
                    reject(new Error('timeout'));
                }
            });
        });

    const createLink = (label, href) => {
        const anchor = document.createElement('a');
        anchor.className = 'last';
        anchor.href = href;
        anchor.textContent = label;
        anchor.setAttribute(CONFIG.LINK_MARKER, '');
        return anchor;
    };

    const createInner = (link) => {
        const inner = document.createElement('div');
        inner.className = 'inner';
        inner.appendChild(link);
        return inner;
    };

    const appendIndexLink = (shortcut) => {
        const href = location.href.replace(CONFIG.PC_HOST, CONFIG.SP_HOST);
        const indexInner = createInner(createLink(CONFIG.INDEX_LABEL, href));
        shortcut.appendChild(indexInner);
        return indexInner;
    };

    const insertEpisode1Link = async (shortcut, referenceInner) => {
        const firstHref = shortcut.querySelector(
            CONFIG.FIRST_LINK_SELECTOR
        )?.href;
        if (!firstHref) {
            return;
        }
        const episode1Inner = createInner(
            createLink(CONFIG.FETCH_ERROR_LABEL, '')
        );
        shortcut.insertBefore(episode1Inner, referenceInner);

        const episode1Link = episode1Inner.querySelector('a');
        try {
            const finalUrl = await fetchFinalUrl(firstHref);
            episode1Link.href = finalUrl.replace(
                CONFIG.PC_HOST,
                CONFIG.SP_HOST
            );
            episode1Link.textContent = CONFIG.EPISODE1_LABEL;
        } catch (error) {
            console.error('スマホ版第１話URLの取得に失敗しました:', error);
        }
    };

    const processShortcut = async (shortcut) => {
        if (shortcut.hasAttribute(CONFIG.LINK_MARKER)) {
            return;
        }
        shortcut.setAttribute(CONFIG.LINK_MARKER, '');

        const indexInner = appendIndexLink(shortcut);
        await insertEpisode1Link(shortcut, indexInner);
    };

    const processAllShortcuts = () => {
        document
            .querySelectorAll(CONFIG.SHORTCUT_SELECTOR)
            .forEach((shortcut) => {
                processShortcut(shortcut).catch((error) => {
                    console.error(
                        'ショートカットブロックの処理に失敗しました:',
                        error
                    );
                });
            });
    };

    const init = () => {
        processAllShortcuts();
        observeDOM(processAllShortcuts);
        console.log('🚀 ニコニコ漫画 スマホ版リンク が初期化されました');
    };

    init();
})();
