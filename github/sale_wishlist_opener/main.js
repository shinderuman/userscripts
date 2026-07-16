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
    const skipList = [];

    const STORAGE_KEY = 'sale_wishlist_priority:' + location.pathname;

    const PRIORITY_MAX = 3;

    const STYLES = {
        priorityPanel: {
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '16px',
            color: '#c9d1d9'
        },
        priorityTitle: {
            margin: '0 0 12px 0',
            fontSize: '16px',
            color: '#f0883e'
        },
        priorityList: {
            listStyle: 'none',
            padding: '0',
            margin: '0'
        },
        priorityItem: {
            padding: '4px 0'
        },
        priorityLink: {
            color: '#58a6ff',
            textDecoration: 'none'
        },
        priorityButton: {
            backgroundColor: '#f0883e'
        },
        monsterTitle: {
            margin: '0 0 12px 0',
            fontSize: '16px',
            color: '#8957e5'
        },
        monsterButton: {
            backgroundColor: '#8957e5'
        },
        scrollButton: {
            backgroundColor: '#28a745'
        },
        highlight: {
            backgroundColor: '#ffffcc',
            transition: 'background-color 0.3s'
        }
    };

    // パネル設定
    const PANEL_CONFIGS = {
        priority: {
            id: 'priority-panel',
            label: '優先パネル表示',
            panelConfig: {
                id: 'priority-panel',
                title: '🌟 優先リスト',
                titleStyle: STYLES.priorityTitle,
                filterFn: (links) =>
                    links
                        .filter((link) => link.isPriority)
                        .sort(
                            (a, b) =>
                                (b.priorityLevel || 0) - (a.priorityLevel || 0)
                        )
            }
        },
        monster: {
            id: 'monster-panel',
            label: 'モンスターコミックス👹表示',
            panelConfig: {
                id: 'monster-panel',
                title: '👹 モンスターコミックス',
                titleStyle: STYLES.monsterTitle,
                filterFn: (links) =>
                    links.filter((link) => link.textContent.includes('👹'))
            }
        }
    };

    const priorityCache = (() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    })();

    const savePriorityCache = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(priorityCache));
    };

    const applyPriorityStyle = (link, level) => {
        link.isPriority = true;
        link.priorityLevel = level;
        link.textContent =
            '🌟'.repeat(level) + ' ' + link.textContent.replace(/^🌟+ /u, '');
    };

    const removePriorityStyle = (link) => {
        link.isPriority = false;
        link.priorityLevel = 0;
        link.textContent = link.textContent.replace(/^🌟+ /u, '');
    };

    const shouldSkipLink = (linkText) => {
        return skipList.some((keyword) => linkText.includes(keyword));
    };

    const initializeSaleWishlistOpener = () => {
        setupUI();
        setupPriorityToggle();
        console.log('🚀 Sale Wishlist Opener が初期化されました');
    };

    const setupUI = () => {
        const container = createContainer();

        // 優先のみ表示トグルボタン
        const priorityButton = createButton(
            '優先パネル表示',
            function () {
                togglePanel(this, PANEL_CONFIGS.priority);
            },
            STYLES.priorityButton
        );
        priorityButton.isFiltering = false;
        container.appendChild(priorityButton);

        // モンスターコミックス👹表示トグルボタン
        const monsterButton = createButton(
            'モンスターコミックス👹表示',
            function () {
                togglePanel(this, PANEL_CONFIGS.monster);
            },
            STYLES.monsterButton
        );
        monsterButton.isFiltering = false;
        container.appendChild(monsterButton);

        // 現在日時にスクロールするボタン
        container.appendChild(
            createButton(
                '現在日時にスクロール',
                () => {
                    scrollToCurrentDate();
                },
                STYLES.scrollButton
            )
        );

        // 過去のリンクを開くボタン
        container.appendChild(
            createButton('過去のリンクを開く', () => {
                filterLinks((linkDate, today) => linkDate < today);
            })
        );

        // 今日以降のリンクを開くボタン
        container.appendChild(
            createButton('今日以降のリンクを開く', () => {
                filterLinks((linkDate, today) => linkDate >= today);
            })
        );

        // すべてのリンクを開くボタン
        container.appendChild(
            createButton('すべてのリンクを開く', () => {
                filterLinks(() => true);
            })
        );

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
            .forEach((link) => processLink(link, conditionFn, today, counters));

        console.log(
            `処理完了: ${counters.opened}個のリンクを開きました, ${counters.skipped}個をスキップしました`
        );
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

        Array.from(links).forEach((link) => {
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
            const targetPosition = viewportHeight * (1 / 16);

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
            Object.assign(closestLink.style, STYLES.highlight);

            setTimeout(() => {
                closestLink.style.backgroundColor = originalBackground;
            }, 2000);
        } else {
            console.warn('日付付きのリンクが見つかりませんでした');
        }
    };

    const buildPanel = ({ id, title, titleStyle, filterFn }) => {
        const panel = document.createElement('div');
        panel.id = id;
        Object.assign(panel.style, STYLES.priorityPanel);

        const titleEl = document.createElement('h2');
        titleEl.textContent = title;
        Object.assign(titleEl.style, titleStyle);
        panel.appendChild(titleEl);

        const list = document.createElement('ul');
        Object.assign(list.style, STYLES.priorityList);

        filterFn(
            Array.from(document.querySelectorAll(SELECTORS.WISHLIST_LINKS))
        ).forEach((link) => {
            const li = document.createElement('li');
            Object.assign(li.style, STYLES.priorityItem);
            const a = document.createElement('a');
            a.href = link.href;
            a.textContent = link.textContent;
            a.target = '_blank';
            Object.assign(a.style, STYLES.priorityLink);
            li.appendChild(a);
            list.appendChild(li);
        });

        panel.appendChild(list);
        return panel;
    };

    const togglePanel = (button, { id, label, panelConfig }) => {
        button.isFiltering = !button.isFiltering;

        document.getElementById(id)?.remove();

        if (button.isFiltering) {
            const article = document.querySelector('#file-md-readme > article');
            if (article) {
                article.insertBefore(
                    buildPanel(panelConfig),
                    article.firstChild
                );
            }
        }

        button.textContent = button.isFiltering ? 'パネルを閉じる' : label;
    };

    const setupPriorityToggle = () => {
        document.querySelectorAll(SELECTORS.WISHLIST_LINKS).forEach((link) => {
            if (link.href in priorityCache) {
                applyPriorityStyle(link, priorityCache[link.href]);
            }

            link.addEventListener('click', (e) => {
                if (!e.shiftKey) return;
                e.preventDefault();

                const currentLevel = link.priorityLevel || 0;

                if (currentLevel >= PRIORITY_MAX) {
                    delete priorityCache[link.href];
                    removePriorityStyle(link);
                } else {
                    const nextLevel = currentLevel + 1;
                    priorityCache[link.href] = nextLevel;
                    applyPriorityStyle(link, nextLevel);
                }

                savePriorityCache();
            });
        });
    };

    // 自動初期化
    initializeSaleWishlistOpener();
})();
