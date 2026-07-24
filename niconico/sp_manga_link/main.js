(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const { observeDOM } = unsafeWindow.NiconicoCommon;

    const CONFIG = {
        // 漫画IDを含むショートカットブロック
        SHORTCUT_SELECTOR: 'div.info_block.shortcut',
        // 追加リンクの挿入済み判定用マーカー
        LINK_MARKER: 'data-sp-manga-link',
        // 追加リンクの表示テキスト
        LINK_LABEL: 'スマホ版で開く',
        // PC版ホスト
        PC_HOST: 'manga.nicovideo.jp',
        // スマホ版ホスト
        SP_HOST: 'sp.manga.nicovideo.jp'
    };

    // 既存ボタン（a.first / a.last）と同デザインのリンクを生成
    const createLink = () => {
        const anchor = document.createElement('a');
        anchor.className = 'last';
        anchor.href = location.href.replace(CONFIG.PC_HOST, CONFIG.SP_HOST);
        anchor.textContent = CONFIG.LINK_LABEL;
        anchor.setAttribute(CONFIG.LINK_MARKER, '');
        return anchor;
    };

    // ショートカットブロック内の末尾にリンク用innerを追加
    const processShortcut = (shortcut) => {
        if (shortcut.hasAttribute(CONFIG.LINK_MARKER)) {
            return;
        }
        shortcut.setAttribute(CONFIG.LINK_MARKER, '');

        // 既存と同じ構造（div.inner > a）で末尾に追加し、ボタン群と横並びにする
        const inner = document.createElement('div');
        inner.className = 'inner';
        inner.appendChild(createLink());
        shortcut.appendChild(inner);
    };

    // 全ショートカットブロックを処理
    const processAllShortcuts = () => {
        document
            .querySelectorAll(CONFIG.SHORTCUT_SELECTOR)
            .forEach(processShortcut);
    };

    // 初期化（即時処理・DOM監視）
    const init = () => {
        processAllShortcuts();
        observeDOM(processAllShortcuts);
        console.log('🚀 ニコニコ漫画 スマホ版リンク が初期化されました');
    };

    init();
})();
