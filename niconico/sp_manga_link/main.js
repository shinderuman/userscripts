(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const { observeDOM } = unsafeWindow.NiconicoCommon;

    const CONFIG = {
        // 漫画IDを含むショートカットブロック
        SHORTCUT_SELECTOR: 'div.info_block.shortcut',
        // 第１話リンク（PC版）のセレクタ
        FIRST_LINK_SELECTOR: 'a.first',
        // 追加リンクの挿入済み判定用マーカー
        LINK_MARKER: 'data-sp-manga-link',
        // スマホ版インデックスリンクの表示テキスト
        INDEX_LABEL: 'スマホ版で開く',
        // スマホ版第１話リンクの表示テキスト
        EPISODE1_LABEL: 'スマホ版第１話から読む',
        // リンク取得失敗時の表示テキスト
        FETCH_ERROR_LABEL: 'スマホ版第１話: 取得失敗',
        // PC版ホスト
        PC_HOST: 'manga.nicovideo.jp',
        // スマホ版ホスト
        SP_HOST: 'sp.manga.nicovideo.jp'
    };

    // PC版第１話URLをFetchし、リダイレクト先の最終URLを取得
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

    // 既存ボタン（a.first / a.last）と同デザインのリンクを生成
    const createLink = (label, href) => {
        const anchor = document.createElement('a');
        anchor.className = 'last';
        anchor.href = href;
        anchor.textContent = label;
        anchor.setAttribute(CONFIG.LINK_MARKER, '');
        return anchor;
    };

    // リンクを包むinner要素を生成
    const createInner = (link) => {
        const inner = document.createElement('div');
        inner.className = 'inner';
        inner.appendChild(link);
        return inner;
    };

    // SP版インデックスへのリンクを末尾に追加
    const appendIndexLink = (shortcut) => {
        const href = location.href.replace(CONFIG.PC_HOST, CONFIG.SP_HOST);
        const indexInner = createInner(createLink(CONFIG.INDEX_LABEL, href));
        shortcut.appendChild(indexInner);
        return indexInner;
    };

    // SP版第１話へのリンクを、指定した基準要素の左隣に追加
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

    // ショートカットブロック内に2つのリンク（第１話・インデックス）を追加
    const processShortcut = async (shortcut) => {
        if (shortcut.hasAttribute(CONFIG.LINK_MARKER)) {
            return;
        }
        shortcut.setAttribute(CONFIG.LINK_MARKER, '');

        const indexInner = appendIndexLink(shortcut);
        await insertEpisode1Link(shortcut, indexInner);
    };

    // 全ショートカットブロックを処理
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

    // 初期化（即時処理・DOM監視）
    const init = () => {
        processAllShortcuts();
        observeDOM(processAllShortcuts);
        console.log('🚀 ニコニコ漫画 スマホ版リンク が初期化されました');
    };

    init();
})();
