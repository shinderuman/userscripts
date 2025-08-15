(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
    } = unsafeWindow.KindleCommon;

    const CONFIG = {
        MAX_PAGES: 20,
        MIN_PRICE: 0,
        BUTTON_STYLES: {
            position: 'fixed',
            top: '25%',
            right: '10px',
            zIndex: '9999',
            padding: '10px 15px',
            background: '#ffd814',
            border: '1px solid #aaa',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '2px 2px 5px rgba(0,0,0,0.2)'
        },
        RESULT_STYLES: {
            padding: '1em',
            background: '#fff8e1',
            border: '2px solid #f0c14b',
            margin: '1em',
            fontFamily: 'sans-serif'
        }
    };

    let results = [];
    let resultContainer = null;

    const extractItemsFromDocument = (doc, pageNum) => {
        const items = doc.querySelectorAll('[data-cy="price-recipe"]');
        const matchedItems = [];

        items.forEach(item => {
            const tag = item.querySelector('span[id^="KINDLE_PROMOTION_TAGS_"]');
            if (!tag) return;

            const priceWhole = item.querySelector('.a-price-whole');
            if (!priceWhole) return;

            const price = parseInt(priceWhole.textContent.replace(/[^\d]/g, ''), 10);
            if (price < CONFIG.MIN_PRICE) return;

            const parent = item.closest('.s-result-item');
            if (!parent) return;

            const titleAnchor = parent.querySelector('[data-cy="title-recipe"] a');
            const h2 = titleAnchor?.querySelector('h2');
            if (!titleAnchor || !h2) return;

            const title = h2.textContent.trim();
            const url = new URL(titleAnchor.href, location.origin).href;

            matchedItems.push({ price, url, pageNum, title });
        });

        return matchedItems;
    };

    const fetchNextPage = async (pageNum) => {
        const url = new URL(location.href);
        url.searchParams.set('page', pageNum);

        try {
            const response = await fetch(url.toString());
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return extractItemsFromDocument(doc, pageNum);
        } catch (error) {
            console.error(`ページ${pageNum}の取得に失敗:`, error);
            throw error;
        }
    };

    const collectAllPages = async (button) => {
        results = [];
        
        for (let i = 1; i <= CONFIG.MAX_PAGES; i++) {
            try {
                const newItems = await fetchNextPage(i);
                results = results.concat(newItems);
                button.textContent = `ページ${i}から${newItems.length}件取得`;
                console.log(`ページ${i}から${newItems.length}件取得`);
            } catch (e) {
                console.warn(`ページ${i}の取得に失敗しました`, e);
                break;
            }
        }

        displayResults();
    };

    const displayResults = () => {
        if (resultContainer) {
            resultContainer.remove();
        }

        results.sort((a, b) => a.price - b.price);

        resultContainer = document.createElement('div');
        Object.assign(resultContainer.style, CONFIG.RESULT_STYLES);
        resultContainer.innerHTML = `<h2>価格順に並んだキャンペーン商品一覧（全${results.length}件）</h2>`;

        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';

        results.forEach(item => {
            const searchUrl = new URL(location.href);
            searchUrl.searchParams.set('page', item.pageNum);

            const li = document.createElement('li');
            li.style.marginBottom = '0.5em';
            li.innerHTML = `<a href="${item.url}" target="_blank">￥${item.price} - ${item.title}</a> | <a href="${searchUrl.href}" target="_blank">${item.pageNum}ページ</a>`;
            list.appendChild(li);
        });

        resultContainer.appendChild(list);
        document.body.prepend(resultContainer);
    };

    const createTriggerButton = () => {
        const button = document.createElement('button');
        button.textContent = '📘 キャンペーン商品を抽出';
        Object.assign(button.style, CONFIG.BUTTON_STYLES);
        
        button.onclick = () => {
            if (resultContainer) {
                resultContainer.remove();
                resultContainer = null;
                button.textContent = '📘 キャンペーン商品を抽出';
                button.disabled = false;
                return;
            }

            button.disabled = true;
            button.textContent = '読み込み中...';
            collectAllPages(button).then(() => {
                button.textContent = '完了（もう一度押すと閉じます）';
                button.disabled = false;
            }).catch((error) => {
                console.error('キャンペーン商品抽出エラー:', error);
                button.textContent = 'エラーが発生しました';
                button.disabled = false;
            });
        };

        document.body.appendChild(button);
    };

    const initializeCampaignSorter = () => {
        createTriggerButton();
        console.log('📘 Kindle Campaign Sorter が初期化されました');
    };

    // グローバル関数として公開
    unsafeWindow.initializeCampaignSorter = initializeCampaignSorter;

    // 自動初期化
    initializeCampaignSorter();
})();