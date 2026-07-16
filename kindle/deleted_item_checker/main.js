(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const { sendCompletionNotification, sendErrorNotification } =
        unsafeWindow.KindleCommon;

    const CONFIG = {
        DEFAULTS: {
            DELETED_ITEMS_START_PAGE: 20,
            DELETED_ITEMS_END_PAGE: 30,
            ORDER_HISTORY_START_PAGE: 2,
            ORDER_HISTORY_END_PAGE: 3
        },
        STYLES: {
            BUTTON: {
                position: 'fixed',
                top: '75%',
                right: '10px',
                zIndex: '9999',
                padding: '10px 15px',
                background: '#ff9900',
                border: '1px solid #aaa',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '2px 2px 5px rgba(0,0,0,0.2)',
                color: 'white'
            },
            CONTROL_PANEL: {
                position: 'fixed',
                top: '50%',
                right: '10px',
                zIndex: '9999',
                padding: '10px',
                background: '#f0f0f0',
                border: '1px solid #aaa',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'sans-serif',
                width: '200px'
            },
            RESULT: {
                padding: '1em',
                background: '#fff8e1',
                border: '2px solid #f0c14b',
                margin: '1em',
                fontFamily: 'sans-serif',
                maxHeight: '400px',
                overflowY: 'auto'
            },
            DELETED_RESULT: {
                padding: '1em',
                background: '#fff8e1',
                border: '2px solid #f0c14b',
                margin: '1em',
                fontFamily: 'sans-serif',
                maxHeight: '600px',
                overflowY: 'auto'
            },
            ORDER_ITEM: {
                marginBottom: '0.5em',
                padding: '0.5em',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#e8f5e8'
            },
            DELETED_ITEM: {
                marginBottom: '1em',
                padding: '0.5em',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9'
            },
            INPUT: {
                width: '50px',
                padding: '2px'
            },
            BUTTON_INLINE: {
                width: '100%',
                padding: '8px',
                background: '#ff9900',
                border: '1px solid #aaa',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'white'
            },
            EXPLANATION: {
                marginTop: '1em',
                padding: '0.5em',
                background: '#f0f0f0',
                borderRadius: '4px'
            },
            LIST: {
                listStyle: 'none',
                padding: '0'
            }
        },
        HTML: {
            CONTROL_PANEL: `
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">注文履歴検索:</label>
                    <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 8px;">
                        <input type="number" id="orderStartPage" value="{{ORDER_HISTORY_START_PAGE}}" min="1">
                        <span>-</span>
                        <input type="number" id="orderEndPage" value="{{ORDER_HISTORY_END_PAGE}}" min="1">
                    </div>
                    <button id="orderHistoryButton" style="margin-bottom: 10px;">📖 注文履歴検索</button>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px;">削除商品チェック:</label>
                    <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 8px;">
                        <input type="number" id="startPage" value="{{DELETED_ITEMS_START_PAGE}}" min="0">
                        <span>-</span>
                        <input type="number" id="endPage" value="{{DELETED_ITEMS_END_PAGE}}" min="1">
                    </div>
                    <button id="deletedItemButton">🗑️ 削除商品をチェック</button>
                </div>
            `,
            EXPLANATION: `
                <p><strong>使用方法:</strong></p>
                <p>各ページリンクをクリックして、削除された商品の前後の商品を確認し、どの商品が削除されたかを特定してください。</p>
            `
        },
        MESSAGES: {
            DELETED: '本商品は現在カタログにありません。'
        }
    };

    let results = [];
    let deletedResultContainer = null;
    let orderResultContainer = null;

    const createSearchLink = (title) => {
        const encodedTitle = encodeURIComponent(title);
        return `https://www.amazon.co.jp/your-orders/search/ref=ppx_yo2ov_dt_b_search?opt=ab&search=${encodedTitle}`;
    };

    const findProductTitle = (item) => {
        const selectors = [
            '._cDEzb_asin-title_zOxXw a .p13n-sc-truncate',
            '.p13n-sc-truncate',
            '._cDEzb_asin-title_zOxXw a'
        ];
        for (const selector of selectors) {
            const element = item.querySelector(selector);
            if (element) return element;
        }
        return null;
    };

    const findSurroundingProduct = (allItems, deletedIndex, direction) => {
        const start =
            direction === 'prev' ? deletedIndex - 1 : deletedIndex + 1;
        const condition =
            direction === 'prev' ? (i) => i >= 0 : (i) => i < allItems.length;
        const step = direction === 'prev' ? -1 : 1;

        for (let i = start; condition(i); i += step) {
            const item = allItems[i];
            if (!item.querySelector('._cDEzb_no-product-msg_2MQ8w')) {
                const titleElement = findProductTitle(item);
                if (titleElement && titleElement.textContent.trim()) {
                    return {
                        type: direction === 'prev' ? '前の商品' : '後の商品',
                        title: titleElement.textContent.trim(),
                        searchLink: createSearchLink(
                            titleElement.textContent.trim()
                        )
                    };
                }
            }
        }
        return null;
    };

    const fetchOrderHistoryPage = async (searchTerm, page = 1) => {
        const encodedSearchTerm = encodeURIComponent(searchTerm);
        const url = `https://www.amazon.co.jp/your-orders/search?page=${page}&search=${encodedSearchTerm}&ref_=ppx_hzsearch_pagination_dt_b_pg_${page - 1}`;

        try {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const orderItems = [];
            const orderElements = doc.querySelectorAll(
                'div.a-section.a-spacing-large.a-spacing-top-large'
            );

            orderElements.forEach((element) => {
                const titleElement = element.querySelector('a[title] p');

                // 注文日を含むテキストを要素全体から検索
                const elementText = element.textContent;
                const dateMatch = elementText.match(
                    /注文日(\d{4}年\d{1,2}月\d{1,2}日)/
                );

                if (titleElement && dateMatch) {
                    const title = titleElement.textContent.trim();
                    const orderDate = dateMatch[1];

                    // 注文詳細ページのURLを抽出
                    const orderDetailLink = element.querySelector(
                        'a[href*="/your-orders/order-details"]'
                    );
                    let orderDetailUrl = '';
                    if (orderDetailLink) {
                        orderDetailUrl =
                            'https://www.amazon.co.jp' +
                            orderDetailLink.getAttribute('href');
                    }

                    orderItems.push({
                        title: title,
                        orderDate: orderDate,
                        orderDetailUrl: orderDetailUrl
                    });
                }
            });

            return orderItems;
        } catch (error) {
            console.error(`注文履歴ページ${page}の取得に失敗:`, error);
            throw error;
        }
    };

    const fetchOrderHistory = async (
        searchTerm,
        startPage = 2,
        endPage = 3
    ) => {
        const allOrderItems = [];

        console.log(
            `📚 注文履歴検索開始: ${searchTerm} (ページ${startPage}-${endPage}を取得)`
        );

        for (let page = startPage; page <= endPage; page++) {
            try {
                console.log(`📄 ページ${page}を取得中...`);
                const pageItems = await fetchOrderHistoryPage(searchTerm, page);
                allOrderItems.push(...pageItems);
                console.log(
                    `✅ ページ${page}完了: ${pageItems.length}件の注文を発見`
                );

                // ページ間で少し待機
                if (page < endPage) {
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
            } catch (error) {
                console.warn(`❌ ページ${page}の取得をスキップ:`, error);
                break;
            }
        }

        console.log(
            `📊 注文履歴検索完了: 合計${allOrderItems.length}件の注文を取得`
        );
        return allOrderItems;
    };

    const findDeletedItemsOnPage = (doc) => {
        const deletedItems = [];

        // 削除メッセージを含む要素を直接検索
        const deletedMessageElements = doc.querySelectorAll(
            '._cDEzb_no-product-msg_2MQ8w'
        );

        if (deletedMessageElements.length === 0) {
            return deletedItems; // 削除商品がない場合は空配列を返す
        }

        // メインの商品リストを取得（複数のセレクターを試行）
        let productList = doc.querySelector(
            'ul.a-unordered-list.a-nostyle.a-vertical'
        );
        if (!productList) {
            productList = doc.querySelector('ul.a-unordered-list');
        }
        if (!productList) {
            productList = doc.querySelector('ul');
        }

        if (productList) {
            // 商品アイテムを取得（複数のセレクターを試行）
            let allItems = Array.from(
                productList.querySelectorAll('li.a-spacing-medium')
            );
            if (allItems.length === 0) {
                allItems = Array.from(productList.querySelectorAll('li'));
            }

            // 削除された商品のインデックスをすべて見つける
            const deletedIndices = [];
            allItems.forEach((item, index) => {
                const deletedMsg = item.querySelector(
                    '._cDEzb_no-product-msg_2MQ8w'
                );
                if (
                    deletedMsg &&
                    deletedMsg.textContent.includes(CONFIG.MESSAGES.DELETED)
                ) {
                    deletedIndices.push(index);
                }
            });

            // 各削除商品について前後の商品を特定
            deletedIndices.forEach((deletedIndex, deletedItemNumber) => {
                const surroundingProducts = [];

                // 前後の商品を取得
                const prevProduct = findSurroundingProduct(
                    allItems,
                    deletedIndex,
                    'prev'
                );
                const nextProduct = findSurroundingProduct(
                    allItems,
                    deletedIndex,
                    'next'
                );

                if (prevProduct) surroundingProducts.push(prevProduct);
                if (nextProduct) surroundingProducts.push(nextProduct);

                deletedItems.push({
                    itemNumber: deletedItemNumber + 1,
                    position: deletedIndex + 1,
                    surroundingProducts: surroundingProducts
                });
            });
        } else {
            console.warn('商品リストが見つかりませんでした');
        }

        return deletedItems;
    };

    const checkPageForDeletedItems = async (pageNum) => {
        const baseUrl = 'https://www.amazon.co.jp/gp/yourstore/iyr';
        const params = new URLSearchParams({
            collection: 'purchased',
            minItem: 1 + pageNum * 15,
            maxItem: 15 + pageNum * 15,
            ref_: 'pd_ys_iyr_prev'
        });

        const url = `${baseUrl}?${params.toString()}`;

        try {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            if (html.includes(CONFIG.MESSAGES.DELETED)) {
                // ページ内の削除商品をすべて検出
                const deletedItems = findDeletedItemsOnPage(doc);

                // 削除商品が検出できない場合はエラー（フォールバックは行わない）
                if (deletedItems.length === 0) {
                    console.warn(
                        `ページ${pageNum}: 削除メッセージは検出されたが、商品の詳細抽出に失敗`
                    );
                    return {
                        pageNum,
                        url,
                        hasDeletedItem: true,
                        deletedItems: [
                            {
                                itemNumber: 1,
                                position: '不明',
                                surroundingProducts: []
                            }
                        ],
                        deletedCount: 1
                    };
                }

                return {
                    pageNum,
                    url,
                    hasDeletedItem: true,
                    deletedItems: deletedItems,
                    deletedCount: deletedItems.length
                };
            }

            return { pageNum, url, hasDeletedItem: false };
        } catch (error) {
            console.error(`ページ${pageNum}の取得に失敗:`, error);
            throw error;
        }
    };

    const scanAllPages = async (button, startPage, endPage) => {
        results = [];
        let foundCount = 0;

        for (let i = startPage; i <= endPage; i++) {
            try {
                const result = await checkPageForDeletedItems(i);

                if (result.hasDeletedItem) {
                    results.push(result);
                    foundCount++;
                }

                button.textContent = `ページ${i}をチェック中... (${foundCount}件発見)`;
                console.log(
                    `ページ${i}をチェック完了 - 削除商品: ${result.hasDeletedItem ? 'あり' : 'なし'}`
                );

                // レート制限対策で少し待機
                await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (e) {
                console.warn(`ページ${i}の取得に失敗しました`, e);
                break;
            }
        }

        displayDeletedResults();
        const totalDeletedItems = results.reduce(
            (sum, item) => sum + (item.deletedCount || 1),
            0
        );
        const totalPages = endPage - startPage + 1;
        sendCompletionNotification(
            '削除商品チェック',
            totalPages,
            `${foundCount}ページ（${totalDeletedItems}件の削除商品）`
        );
    };

    const displayOrderResults = (orderItems = []) => {
        if (orderResultContainer) {
            orderResultContainer.remove();
        }

        orderResultContainer = document.createElement('div');
        Object.assign(orderResultContainer.style, CONFIG.STYLES.RESULT);

        // 注文履歴セクションを追加
        if (orderItems.length > 0) {
            const orderHistorySection = document.createElement('div');
            orderHistorySection.innerHTML = `<h2><a href="https://www.amazon.co.jp/your-orders/search?search=ヤングジャンプ&ref_=ppx_hzsearch_sb_dt_b" target="_blank" style="color: inherit; text-decoration: none;">ヤングジャンプの注文履歴（${orderItems.length}件）</a></h2>`;

            const orderList = document.createElement('ul');
            Object.assign(orderList.style, CONFIG.STYLES.LIST);

            orderItems.forEach((item) => {
                const li = document.createElement('li');
                Object.assign(li.style, CONFIG.STYLES.ORDER_ITEM);

                const titleLink = item.orderDetailUrl
                    ? `<a href="${item.orderDetailUrl}" target="_blank">${item.title}</a>`
                    : item.title;

                li.innerHTML = `<strong>${titleLink}</strong> <span style="color: #666; font-size: 0.9em;">(${item.orderDate})</span>`;
                orderList.appendChild(li);
            });

            orderHistorySection.appendChild(orderList);
            orderHistorySection.style.marginBottom = '2em';
            orderResultContainer.appendChild(orderHistorySection);
        } else {
            orderResultContainer.innerHTML =
                '<h2>ヤングジャンプの注文履歴が見つかりませんでした</h2>';
        }

        // 注文履歴は常に上に表示
        if (deletedResultContainer && deletedResultContainer.parentNode) {
            document.body.insertBefore(
                orderResultContainer,
                deletedResultContainer
            );
        } else {
            document.body.prepend(orderResultContainer);
        }
    };

    const displayDeletedResults = () => {
        if (deletedResultContainer) {
            deletedResultContainer.remove();
        }

        deletedResultContainer = document.createElement('div');
        Object.assign(
            deletedResultContainer.style,
            CONFIG.STYLES.DELETED_RESULT
        );

        // 削除商品セクション
        if (results.length === 0) {
            const deletedSection = document.createElement('div');
            deletedSection.innerHTML =
                '<h2>削除された商品は見つかりませんでした</h2>';
            deletedResultContainer.appendChild(deletedSection);
        } else {
            const totalDeletedItems = results.reduce(
                (sum, item) => sum + (item.deletedCount || 1),
                0
            );
            const deletedSection = document.createElement('div');
            deletedSection.innerHTML = `<h2>削除された商品が含まれるページ（${results.length}ページ、合計${totalDeletedItems}件の削除商品）</h2>`;

            const list = document.createElement('ul');
            Object.assign(list.style, CONFIG.STYLES.LIST);

            results.forEach((item, index) => {
                const li = document.createElement('li');
                Object.assign(li.style, CONFIG.STYLES.DELETED_ITEM);

                // 前の削除ページとの差を計算
                let pageDiffText = '';
                if (index > 0) {
                    const prevPageNum = results[index - 1].pageNum;
                    const pageDiff = item.pageNum - prevPageNum;
                    pageDiffText = ` <span style="color: #666; font-size: 0.9em;">(前回から+${pageDiff}ページ)</span>`;
                }

                let content = `<div><strong><a href="${item.url}" target="_blank">ページ${item.pageNum}に削除された商品があります</a></strong>${pageDiffText}`;

                if (item.deletedCount && item.deletedCount > 1) {
                    content += ` <span style="color: #d73502;">(${item.deletedCount}件の削除商品)</span>`;
                }

                content += '</div>';

                if (item.deletedItems && item.deletedItems.length > 0) {
                    item.deletedItems.forEach((deletedItem) => {
                        if (item.deletedItems.length > 1) {
                            content += `<div style="margin-top: 0.5em;"><strong>削除商品 ${deletedItem.itemNumber} (位置: ${deletedItem.position}):</strong></div>`;
                        } else {
                            content +=
                                '<div style="margin-top: 0.5em;"><strong>前後の商品:</strong></div>';
                        }

                        if (
                            deletedItem.surroundingProducts &&
                            deletedItem.surroundingProducts.length > 0
                        ) {
                            content +=
                                '<ul style="margin: 0.25em 0; padding-left: 1.5em;">';
                            deletedItem.surroundingProducts.forEach(
                                (product) => {
                                    if (
                                        typeof product === 'object' &&
                                        product.title
                                    ) {
                                        content += `<li style="margin-bottom: 0.25em;">${product.type}: <a href="${product.searchLink}" target="_blank">${product.title}</a></li>`;
                                    } else {
                                        content += `<li style="margin-bottom: 0.25em;">${product}</li>`;
                                    }
                                }
                            );
                            content += '</ul>';
                        } else {
                            content +=
                                '<div style="margin-left: 1.5em; color: #666;">前後の商品情報を取得できませんでした</div>';
                        }
                    });
                }

                li.innerHTML = content;
                list.appendChild(li);
            });

            deletedSection.appendChild(list);
            deletedResultContainer.appendChild(deletedSection);

            // 説明を追加
            const explanation = document.createElement('div');
            Object.assign(explanation.style, CONFIG.STYLES.EXPLANATION);
            explanation.innerHTML = CONFIG.HTML.EXPLANATION;
            deletedResultContainer.appendChild(explanation);
        }

        // 削除商品は常に下に表示（注文履歴の後）
        if (orderResultContainer && orderResultContainer.parentNode) {
            orderResultContainer.parentNode.insertBefore(
                deletedResultContainer,
                orderResultContainer.nextSibling
            );
        } else {
            document.body.prepend(deletedResultContainer);
        }
    };

    const createControlPanel = () => {
        // コントロールパネルを作成
        const controlContainer = document.createElement('div');
        Object.assign(controlContainer.style, CONFIG.STYLES.CONTROL_PANEL);

        controlContainer.innerHTML = CONFIG.HTML.CONTROL_PANEL.replace(
            '{{ORDER_HISTORY_START_PAGE}}',
            CONFIG.DEFAULTS.ORDER_HISTORY_START_PAGE
        )
            .replace(
                '{{ORDER_HISTORY_END_PAGE}}',
                CONFIG.DEFAULTS.ORDER_HISTORY_END_PAGE
            )
            .replace(
                '{{DELETED_ITEMS_START_PAGE}}',
                CONFIG.DEFAULTS.DELETED_ITEMS_START_PAGE
            )
            .replace(
                '{{DELETED_ITEMS_END_PAGE}}',
                CONFIG.DEFAULTS.DELETED_ITEMS_END_PAGE
            );

        // スタイルを適用
        const inputs = controlContainer.querySelectorAll('input');
        inputs.forEach((input) =>
            Object.assign(input.style, CONFIG.STYLES.INPUT)
        );

        const buttons = controlContainer.querySelectorAll('button');
        buttons.forEach((button) =>
            Object.assign(button.style, CONFIG.STYLES.BUTTON_INLINE)
        );

        document.body.appendChild(controlContainer);

        // ボタンのイベントリスナーを設定
        setupOrderHistoryButton();
        setupDeletedItemButton();
    };

    const setupOrderHistoryButton = () => {
        const button = document.getElementById('orderHistoryButton');

        button.onclick = () => {
            if (orderResultContainer) {
                orderResultContainer.remove();
                orderResultContainer = null;
                button.textContent = '📖 注文履歴検索';
                button.disabled = false;
                return;
            }

            // 注文履歴のページ範囲を取得
            const orderStartPageInput =
                document.getElementById('orderStartPage');
            const orderEndPageInput = document.getElementById('orderEndPage');
            const orderStartPage = parseInt(orderStartPageInput.value);
            const orderEndPage = parseInt(orderEndPageInput.value);

            // 入力値の検証
            if (orderStartPage > orderEndPage) {
                alert('開始ページは終了ページより小さい値を入力してください。');
                return;
            }

            button.disabled = true;
            button.textContent = '注文履歴を取得中...';

            fetchOrderHistory('ヤングジャンプ', orderStartPage, orderEndPage)
                .then((orderItems) => {
                    displayOrderResults(orderItems);
                    const totalPages = orderEndPage - orderStartPage + 1;
                    sendCompletionNotification(
                        '注文履歴検索',
                        totalPages,
                        `${orderItems.length}件の注文履歴`
                    );
                    button.textContent = '完了（もう一度押すと閉じます）';
                    button.disabled = false;
                })
                .catch((error) => {
                    console.error('注文履歴取得エラー:', error);
                    sendErrorNotification('注文履歴検索', error.message);
                    button.textContent = 'エラーが発生しました';
                    button.disabled = false;
                });
        };
    };

    const setupDeletedItemButton = () => {
        const button = document.getElementById('deletedItemButton');

        button.onclick = () => {
            if (deletedResultContainer) {
                deletedResultContainer.remove();
                deletedResultContainer = null;
                button.textContent = '🗑️ 削除商品をチェック';
                button.disabled = false;
                return;
            }

            // 入力値を取得
            const startPageInput = document.getElementById('startPage');
            const endPageInput = document.getElementById('endPage');
            const startPage = parseInt(startPageInput.value);
            const endPage = parseInt(endPageInput.value);

            // 入力値の検証
            if (startPage > endPage) {
                alert('開始ページは終了ページより小さい値を入力してください。');
                return;
            }

            button.disabled = true;
            button.textContent = '読み込み中...';
            scanAllPages(button, startPage, endPage)
                .then(() => {
                    button.textContent = '完了（もう一度押すと閉じます）';
                    button.disabled = false;
                })
                .catch((error) => {
                    console.error('削除商品チェックエラー:', error);
                    sendErrorNotification('削除商品チェック', error.message);
                    button.textContent = 'エラーが発生しました';
                    button.disabled = false;
                });
        };
    };

    const initializeDeletedItemChecker = () => {
        createControlPanel();
        console.log('🗑️ Kindle Deleted Item Checker が初期化されました');
    };

    // 自動初期化
    initializeDeletedItemChecker();
})();
