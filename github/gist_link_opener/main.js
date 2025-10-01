(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        createButton,
        createContainer,
        parseDate,
        getTodayStart
    } = unsafeWindow.GitHubCommon;

    // スキップするキーワードリスト
    const skipList = [
        '中卒労働者から始める高校生活',
        '紅い霧の中から',
        'アフター0',
        '不遇職『鍛冶師』だけど最強です'
    ];

    const initializeGistLinkOpener = () => {
        setupUI();
        console.log('🚀 Gist Link Opener が初期化されました');
    };

    const setupUI = () => {
        const container = createContainer();

        // 過去のリンクを開くボタン
        container.appendChild(createButton('過去のリンクを開く', () => {
            filterLinks((linkDate, today) => linkDate < today);
        }));

        // 今日以降のリンクを開くボタン
        container.appendChild(createButton('今日以降のリンクを開く', () => {
            filterLinks((linkDate, today) => linkDate >= today);
        }));

        // すべてのリンクを開くボタン
        container.appendChild(createButton('すべてのリンクを開く', () => {
            filterLinks(() => true);
        }));

        document.body.appendChild(container);
    };

    const filterLinks = (conditionFn) => {
        const links = document.querySelectorAll('#file-md-readme > article > ul > li > a');
        if (links.length === 0) {
            console.warn('対象のリンクが見つかりませんでした');
            return;
        }

        const today = getTodayStart();
        const counters = { opened: 0, skipped: 0 };

        Array.from(links)
            .reverse()
            .forEach(link => processLink(link, conditionFn, today, counters));

        console.log(`処理完了: ${counters.opened}個のリンクを開きました, ${counters.skipped}個をスキップしました`);
    };

    const processLink = (link, conditionFn, today, counters) => {
        const linkDate = parseDate(link.textContent);
        if (!linkDate) {
            return;
        }

        if (shouldSkipLink(link.textContent)) {
            counters.skipped++;
            return;
        }

        if (conditionFn(linkDate, today)) {
            window.open(link.href, '_blank');
            counters.opened++;
        }
    };

    const shouldSkipLink = (linkText) => {
        return skipList.some(keyword => linkText.includes(keyword));
    };

    // 自動初期化
    initializeGistLinkOpener();
})();