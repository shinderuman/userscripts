(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        sendCompletionNotification,
        sendErrorNotification
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        DEFAULT_END_PAGE: 100,
        DEFAULT_START_PAGE: 0,
        BUTTON_STYLES: {
            position: 'fixed',
            top: '25%',
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
        CONTROL_STYLES: {
            position: 'fixed',
            top: '35%',
            right: '10px',
            zIndex: '9999',
            padding: '10px',
            background: '#f0f0f0',
            border: '1px solid #aaa',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'sans-serif'
        },
        RESULT_STYLES: {
            padding: '1em',
            background: '#fff8e1',
            border: '2px solid #f0c14b',
            margin: '1em',
            fontFamily: 'sans-serif',
            maxHeight: '400px',
            overflowY: 'auto'
        },
        DELETED_MESSAGE: '本商品は現在カタログにありません。'
    };

    let results = [];
    let resultContainer = null;

    const createSearchLink = (title) => {
        const encodedTitle = encodeURIComponent(title);
        return `https://www.amazon.co.jp/your-orders/search/ref=ppx_yo2ov_dt_b_search?opt=ab&search=${encodedTitle}`;
    };

    const findDeletedItemsOnPage = (doc) => {
        const deletedItems = [];

        // 削除メッセージを含む要素を直接検索
        const deletedMessageElements = doc.querySelectorAll('._cDEzb_no-product-msg_2MQ8w');

        if (deletedMessageElements.length === 0) {
            return deletedItems; // 削除商品がない場合は空配列を返す
        }

        // メインの商品リストを取得（複数のセレクターを試行）
        let productList = doc.querySelector('ul.a-unordered-list.a-nostyle.a-vertical');
        if (!productList) {
            productList = doc.querySelector('ul.a-unordered-list');
        }
        if (!productList) {
            productList = doc.querySelector('ul');
        }

        if (productList) {
            // 商品アイテムを取得（複数のセレクターを試行）
            let allItems = Array.from(productList.querySelectorAll('li.a-spacing-medium'));
            if (allItems.length === 0) {
                allItems = Array.from(productList.querySelectorAll('li'));
            }

            // 削除された商品のインデックスをすべて見つける
            const deletedIndices = [];
            allItems.forEach((item, index) => {
                const deletedMsg = item.querySelector('._cDEzb_no-product-msg_2MQ8w');
                if (deletedMsg && deletedMsg.textContent.includes(CONFIG.DELETED_MESSAGE)) {
                    deletedIndices.push(index);
                }
            });

            // 各削除商品について前後の商品を特定
            deletedIndices.forEach((deletedIndex, deletedItemNumber) => {
                const surroundingProducts = [];

                // 前の商品を取得（削除商品ではない最初の商品を探す）
                for (let i = deletedIndex - 1; i >= 0; i--) {
                    const prevItem = allItems[i];
                    const prevDeletedMsg = prevItem.querySelector('._cDEzb_no-product-msg_2MQ8w');
                    if (!prevDeletedMsg) {
                        // 複数のセレクターで商品タイトルを探す
                        let prevTitle = prevItem.querySelector('._cDEzb_asin-title_zOxXw a .p13n-sc-truncate');
                        if (!prevTitle) {
                            prevTitle = prevItem.querySelector('.p13n-sc-truncate');
                        }
                        if (!prevTitle) {
                            prevTitle = prevItem.querySelector('._cDEzb_asin-title_zOxXw a');
                        }
                        if (prevTitle && prevTitle.textContent.trim()) {
                            const title = prevTitle.textContent.trim();
                            const searchLink = createSearchLink(title);
                            surroundingProducts.push({
                                type: '前の商品',
                                title: title,
                                searchLink: searchLink
                            });
                            break;
                        }
                    }
                }

                // 後の商品を取得（削除商品ではない最初の商品を探す）
                for (let i = deletedIndex + 1; i < allItems.length; i++) {
                    const nextItem = allItems[i];
                    const nextDeletedMsg = nextItem.querySelector('._cDEzb_no-product-msg_2MQ8w');
                    if (!nextDeletedMsg) {
                        // 複数のセレクターで商品タイトルを探す
                        let nextTitle = nextItem.querySelector('._cDEzb_asin-title_zOxXw a .p13n-sc-truncate');
                        if (!nextTitle) {
                            nextTitle = nextItem.querySelector('.p13n-sc-truncate');
                        }
                        if (!nextTitle) {
                            nextTitle = nextItem.querySelector('._cDEzb_asin-title_zOxXw a');
                        }
                        if (nextTitle && nextTitle.textContent.trim()) {
                            const title = nextTitle.textContent.trim();
                            const searchLink = createSearchLink(title);
                            surroundingProducts.push({
                                type: '後の商品',
                                title: title,
                                searchLink: searchLink
                            });
                            break;
                        }
                    }
                }

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
            if (html.includes(CONFIG.DELETED_MESSAGE)) {
                // ページ内の削除商品をすべて検出
                const deletedItems = findDeletedItemsOnPage(doc);

                // 削除商品が検出できない場合はエラー（フォールバックは行わない）
                if (deletedItems.length === 0) {
                    console.warn(`ページ${pageNum}: 削除メッセージは検出されたが、商品の詳細抽出に失敗`);
                    return {
                        pageNum,
                        url,
                        hasDeletedItem: true,
                        deletedItems: [{
                            itemNumber: 1,
                            position: '不明',
                            surroundingProducts: []
                        }],
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
                console.log(`ページ${i}をチェック完了 - 削除商品: ${result.hasDeletedItem ? 'あり' : 'なし'}`);

                // レート制限対策で少し待機
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (e) {
                console.warn(`ページ${i}の取得に失敗しました`, e);
                break;
            }
        }

        displayResults();
        const totalDeletedItems = results.reduce((sum, item) => sum + (item.deletedCount || 1), 0);
        const totalPages = endPage - startPage + 1;
        sendCompletionNotification('削除商品チェック', totalPages, `${foundCount}ページ（${totalDeletedItems}件の削除商品）`);
    };

    const displayResults = () => {
        if (resultContainer) {
            resultContainer.remove();
        }

        resultContainer = document.createElement('div');
        Object.assign(resultContainer.style, CONFIG.RESULT_STYLES);

        if (results.length === 0) {
            resultContainer.innerHTML = '<h2>削除された商品は見つかりませんでした</h2>';
        } else {
            const totalDeletedItems = results.reduce((sum, item) => sum + (item.deletedCount || 1), 0);
            resultContainer.innerHTML = `<h2>削除された商品が含まれるページ（${results.length}ページ、合計${totalDeletedItems}件の削除商品）</h2>`;

            const list = document.createElement('ul');
            list.style.listStyle = 'none';
            list.style.padding = '0';

            results.forEach((item, index) => {
                const li = document.createElement('li');
                li.style.marginBottom = '1em';
                li.style.padding = '0.5em';
                li.style.border = '1px solid #ddd';
                li.style.borderRadius = '4px';
                li.style.backgroundColor = '#f9f9f9';

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
                            content += '<div style="margin-top: 0.5em;"><strong>前後の商品:</strong></div>';
                        }

                        if (deletedItem.surroundingProducts && deletedItem.surroundingProducts.length > 0) {
                            content += '<ul style="margin: 0.25em 0; padding-left: 1.5em;">';
                            deletedItem.surroundingProducts.forEach(product => {
                                if (typeof product === 'object' && product.title) {
                                    content += `<li style="margin-bottom: 0.25em;">${product.type}: <a href="${product.searchLink}" target="_blank">${product.title}</a></li>`;
                                } else {
                                    content += `<li style="margin-bottom: 0.25em;">${product}</li>`;
                                }
                            });
                            content += '</ul>';
                        } else {
                            content += '<div style="margin-left: 1.5em; color: #666;">前後の商品情報を取得できませんでした</div>';
                        }
                    });
                } else if (item.surroundingProducts && item.surroundingProducts.length > 0) {
                    // 旧形式との互換性のため
                    content += '<div style="margin-top: 0.5em;"><strong>前後の商品:</strong></div>';
                    content += '<ul style="margin: 0.25em 0; padding-left: 1.5em;">';
                    item.surroundingProducts.forEach(product => {
                        if (typeof product === 'object' && product.title) {
                            content += `<li style="margin-bottom: 0.25em;">${product.type}: <a href="${product.searchLink}" target="_blank">${product.title}</a></li>`;
                        } else {
                            content += `<li style="margin-bottom: 0.25em;">${product}</li>`;
                        }
                    });
                    content += '</ul>';
                }

                li.innerHTML = content;
                list.appendChild(li);
            });

            resultContainer.appendChild(list);

            // 説明を追加
            const explanation = document.createElement('div');
            explanation.style.marginTop = '1em';
            explanation.style.padding = '0.5em';
            explanation.style.background = '#f0f0f0';
            explanation.style.borderRadius = '4px';
            explanation.innerHTML = `
                <p><strong>使用方法:</strong></p>
                <p>各ページリンクをクリックして、削除された商品の前後の商品を確認し、どの商品が削除されたかを特定してください。</p>
            `;
            resultContainer.appendChild(explanation);
        }

        document.body.prepend(resultContainer);
    };

    const createControlPanel = () => {
        // コントロールパネルを作成
        const controlContainer = document.createElement('div');
        Object.assign(controlContainer.style, CONFIG.CONTROL_STYLES);

        controlContainer.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">開始ページ:</label>
                <input type="number" id="startPage" value="${CONFIG.DEFAULT_START_PAGE}" min="0" style="width: 60px; padding: 2px;">
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">終了ページ:</label>
                <input type="number" id="endPage" value="${CONFIG.DEFAULT_END_PAGE}" min="1" style="width: 60px; padding: 2px;">
            </div>
        `;

        document.body.appendChild(controlContainer);
    };

    const createTriggerButton = () => {
        const button = document.createElement('button');
        button.textContent = '🗑️ 削除商品をチェック';
        Object.assign(button.style, CONFIG.BUTTON_STYLES);

        button.onclick = () => {
            if (resultContainer) {
                resultContainer.remove();
                resultContainer = null;
                button.textContent = '🗑️ 削除商品をチェック';
                button.disabled = false;
                return;
            }

            // 入力値を取得
            const startPageInput = document.getElementById('startPage');
            const endPageInput = document.getElementById('endPage');
            const startPage = parseInt(startPageInput.value) || CONFIG.DEFAULT_START_PAGE;
            const endPage = parseInt(endPageInput.value) || CONFIG.DEFAULT_END_PAGE;

            // 入力値の検証
            if (startPage > endPage) {
                // eslint-disable-next-line no-undef
                alert('開始ページは終了ページより小さい値を入力してください。');
                return;
            }

            button.disabled = true;
            button.textContent = '読み込み中...';
            scanAllPages(button, startPage, endPage).then(() => {
                button.textContent = '完了（もう一度押すと閉じます）';
                button.disabled = false;
            }).catch((error) => {
                console.error('削除商品チェックエラー:', error);
                sendErrorNotification('削除商品チェック', error.message);
                button.textContent = 'エラーが発生しました';
                button.disabled = false;
            });
        };

        document.body.appendChild(button);
    };

    const initializeDeletedItemChecker = () => {
        createControlPanel();
        createTriggerButton();
        console.log('🗑️ Kindle Deleted Item Checker が初期化されました');
    };

    // グローバル関数として公開
    unsafeWindow.initializeDeletedItemChecker = initializeDeletedItemChecker;

    // 自動初期化
    initializeDeletedItemChecker();
})();