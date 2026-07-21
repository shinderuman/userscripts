(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const { observeDOM, markAsProcessed, isProcessed } = unsafeWindow.DMMCommon;

    // 4状態の定義（キー・短縮ラベル・ツールチップ全文・色）
    // 循環順: OK -> NG -> 要Player -> 未確認 -> OK
    const STATUSES = [
        {
            key: 'ok',
            label: '動作OK',
            title: 'Parallels上のWindows動作確認OK',
            color: '#2e7d32'
        },
        {
            key: 'ng',
            label: '動作NG',
            title: 'Parallels上のWindows動作確認NG',
            color: '#c62828'
        },
        {
            key: 'gp',
            label: '要Player',
            title: 'DMM Game Player必須',
            color: '#1565c0'
        },
        {
            key: 'unknown',
            label: '未確認',
            title: 'Parallels上のWindows動作未確認',
            color: '#616161'
        }
    ];

    const CONFIG = {
        CARD_SELECTOR: '.productCard.productList__productCard',
        TAG_CONTAINER_SELECTOR: '.productCard__tagContainer',
        REVIEW_BUTTON_SELECTOR: '.productCard__reviewButton',
        PROCESSED_MARKER: 'parallelsToggle',
        STORAGE_KEY: 'dmm-parallels-status',
        BUTTON_ATTR: 'data-parallels-toggle',
        DEFAULT_KEY: 'unknown'
    };

    // localStorage から全状態を読み込み（商品ID -> statusKey）
    const loadStatuses = () => {
        try {
            const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.error('状態の読み込みに失敗しました:', error);
            return {};
        }
    };

    // localStorage へ全状態を保存
    const saveStatuses = (statuses) => {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(statuses));
        } catch (error) {
            console.error('状態の保存に失敗しました:', error);
        }
    };

    // 商品IDから現在の状態を取得（未設定はデフォルト=未確認）
    const getStatus = (contentId) =>
        loadStatuses()[contentId] ?? CONFIG.DEFAULT_KEY;

    // 商品IDの状態を設定
    const setStatus = (contentId, key) => {
        const statuses = loadStatuses();
        statuses[contentId] = key;
        saveStatuses(statuses);
    };

    // カードから商品IDを抽出（reviewButtonのhrefのcontent_idパラメータ）
    const extractContentId = (card) => {
        const reviewButton = card.querySelector(CONFIG.REVIEW_BUTTON_SELECTOR);
        if (!reviewButton) {
            return null;
        }
        const url = new URL(reviewButton.href);
        return url.searchParams.get('content_id');
    };

    // 現在の状態から次の状態を取得（循環）
    const getNextStatus = (currentKey) => {
        const keys = STATUSES.map((status) => status.key);
        const currentIndex = keys.indexOf(currentKey);
        const nextIndex = (currentIndex + 1) % keys.length;
        return STATUSES[nextIndex];
    };

    // 現在の状態に合わせてボタン表示を更新
    const updateButton = (button, currentStatus) => {
        button.textContent = currentStatus.label;
        button.title = currentStatus.title;
        button.dataset.status = currentStatus.key;
        button.style.backgroundColor = currentStatus.color;
        button.style.borderColor = currentStatus.color;
    };

    // カードに循環トグルボタンを1つ生成
    const createButton = (contentId) => {
        const button = document.createElement('span');
        button.setAttribute(CONFIG.BUTTON_ATTR, '');
        button.style.display = 'inline-flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.height = '19px';
        button.style.padding = '4px 6px';
        button.style.borderRadius = '4px';
        button.style.borderWidth = '1px';
        button.style.borderStyle = 'solid';
        button.style.fontSize = '11px';
        button.style.textAlign = 'center';
        button.style.whiteSpace = 'nowrap';
        button.style.color = '#fff';
        button.style.lineHeight = '1.5';
        button.style.boxSizing = 'border-box';
        button.style.cursor = 'pointer';
        // タグコンテナの右端に固定（「ブラウザ対応」と同じ高さの右端）
        button.style.position = 'absolute';
        button.style.right = '0';
        button.style.top = '0';

        const currentStatus =
            STATUSES.find((status) => status.key === getStatus(contentId)) ??
            STATUSES.find((status) => status.key === CONFIG.DEFAULT_KEY);
        updateButton(button, currentStatus);

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            const nextStatus = getNextStatus(button.dataset.status);
            setStatus(contentId, nextStatus.key);
            updateButton(button, nextStatus);
        });

        return button;
    };

    // カード1枚の処理（処理済み判定・ID取得・ボタン挿入）
    const processCard = (card) => {
        if (isProcessed(card, CONFIG.PROCESSED_MARKER)) {
            return;
        }
        const contentId = extractContentId(card);
        if (!contentId) {
            return;
        }
        markAsProcessed(card, CONFIG.PROCESSED_MARKER);

        const container = card.querySelector(CONFIG.TAG_CONTAINER_SELECTOR);
        if (!container) {
            return;
        }
        // ボタンを右端に固定するための配置基準を設定
        container.style.position = 'relative';
        // 既存タグ（ブラウザ対応等）と同じ高さの右端に追加
        container.appendChild(createButton(contentId));
    };

    // 全カードを処理
    const processAllCards = () => {
        document.querySelectorAll(CONFIG.CARD_SELECTOR).forEach(processCard);
    };

    // 初期化（即時処理・DOM監視）
    const init = () => {
        processAllCards();
        observeDOM(processAllCards);
        console.log(
            '🚀 DMM Library Parallels Status Toggle が初期化されました'
        );
        console.log('💡 各カードの動作確認状態をトグル記録します');
    };

    init();
})();
