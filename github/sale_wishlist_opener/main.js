(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        createButton,
        createContainer,
        parseDate,
        getTodayStart,
        SELECTORS
    } = unsafeWindow.GitHubCommon;

    // スキップするキーワードリスト
    const skipList = [
        '底辺冒険者だけど魔法を極めてみることにした',
        '渡くんの××が崩壊寸前',
        '中卒労働者から始める高校生活',
        '不遇職『鍛冶師』だけど最強です'
    ];

    const initializeSaleWishlistOpener = () => {
        setupUI();
        console.log('🚀 Sale Wishlist Opener が初期化されました');
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

        // 現在日時にスクロールするボタン
        container.appendChild(createButton('現在日時にスクロール', () => {
            scrollToCurrentDate();
        }, {
            backgroundColor: '#28a745'
        }));

        document.body.appendChild(container);
    };

    const filterLinks = (conditionFn) => {
        const links = document.querySelectorAll(SELECTORS.WISHLIST_LINKS);
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

    const scrollToCurrentDate = () => {
        const links = document.querySelectorAll(SELECTORS.WISHLIST_LINKS);
        if (links.length === 0) {
            console.warn('対象のリンクが見つかりませんでした');
            return;
        }

        const today = getTodayStart();
        let closestLink = null;
        let minDiff = Infinity;

        Array.from(links).forEach(link => {
            const linkDate = parseDate(link.textContent);
            if (!linkDate) return;

            // 未来の日付は対象外
            if (linkDate > today) return;

            const diff = today.getTime() - linkDate.getTime();
            if (diff < minDiff) {
                minDiff = diff;
                closestLink = link;
            }
        });

        if (closestLink) {
            // ページの高さを取得して1/8の位置を計算
            const viewportHeight = window.innerHeight;
            const targetPosition = viewportHeight * (1/16);

            // 要素の現在の位置を取得
            const rect = closestLink.getBoundingClientRect();
            const currentScrollY = window.pageYOffset;
            const targetScrollY = currentScrollY + rect.top - targetPosition;

            // スムーズにスクロール
            window.scrollTo({
                top: targetScrollY,
                behavior: 'smooth'
            });

            // 視覚的なハイライトを追加
            const originalBackground = closestLink.style.backgroundColor;
            closestLink.style.backgroundColor = '#ffffcc';
            closestLink.style.transition = 'background-color 0.3s';

            setTimeout(() => {
                closestLink.style.backgroundColor = originalBackground;
            }, 2000);
        } else {
            console.warn('日付付きのリンクが見つかりませんでした');
        }
    };

    const shouldSkipLink = (linkText) => {
        return skipList.some(keyword => linkText.includes(keyword));
    };

    // 自動初期化
    initializeSaleWishlistOpener();
})();
