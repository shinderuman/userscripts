(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        createButton,
        createContainer,
        parseDate
    } = unsafeWindow.GitHubCommon;

    let baseDateInput = null;

    const initializeNewReleaseChecker = () => {
        setupUI();
        console.log('🚀 New Release Checker が初期化されました');
    };

    const setupUI = () => {
        const container = createContainer();

        // 基準日付入力フィールド
        const dateLabel = document.createElement('label');
        dateLabel.textContent = '基準日付:';
        dateLabel.style.fontSize = '12px';
        dateLabel.style.color = '#586069';
        dateLabel.style.marginBottom = '5px';

        baseDateInput = document.createElement('input');
        baseDateInput.type = 'date';
        baseDateInput.value = new Date().toISOString().split('T')[0];
        baseDateInput.style.padding = '5px';
        baseDateInput.style.border = '1px solid #d1d5da';
        baseDateInput.style.borderRadius = '3px';
        baseDateInput.style.marginBottom = '10px';
        baseDateInput.style.width = '100%';

        container.appendChild(dateLabel);
        container.appendChild(baseDateInput);

        // 過去のリンクを開くボタン
        container.appendChild(createButton('過去のリンクを開く', () => {
            filterLinks((linkDate, baseDate) => linkDate < baseDate);
        }));

        // 今日以降のリンクを開くボタン
        container.appendChild(createButton('基準日以降のリンクを開く', () => {
            filterLinks((linkDate, baseDate) => linkDate >= baseDate);
        }));

        // すべてのリンクを開くボタン
        container.appendChild(createButton('すべてのリンクを開く', () => {
            filterLinks(() => true);
        }));

        document.body.appendChild(container);
    };

    const getBaseDate = () => {
        const dateValue = baseDateInput.value;
        if (!dateValue) return new Date();
        
        const baseDate = new Date(dateValue);
        baseDate.setHours(0, 0, 0, 0);
        return baseDate;
    };

    const filterLinks = (conditionFn) => {
        const links = document.querySelectorAll('#file-md-readme > article > markdown-accessiblity-table > table > tbody > tr > td:nth-child(2) > a');
        if (links.length === 0) {
            console.warn('対象のリンクが見つかりませんでした');
            return;
        }

        const baseDate = getBaseDate();
        const counters = { opened: 0, skipped: 0 };

        Array.from(links)
            .reverse()
            .forEach(link => processLink(link, conditionFn, baseDate, counters));

        console.log(`処理完了: ${counters.opened}個のリンクを開きました, ${counters.skipped}個をスキップしました`);
    };

    const processLink = (link, conditionFn, baseDate, counters) => {
        const linkDate = parseDate(link.textContent);
        if (!linkDate) {
            counters.skipped++;
            return;
        }

        if (conditionFn(linkDate, baseDate)) {
            window.open(link.href, '_blank');
            counters.opened++;
        } else {
            counters.skipped++;
        }
    };

    // 自動初期化
    initializeNewReleaseChecker();
})();