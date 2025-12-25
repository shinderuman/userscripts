(function () {
    'use strict';

    const CONFIG = {
        // 集計対象の列インデックス（theadのnth-childをベース）
        TARGET_COLUMNS: {
            API_KEY: 3,       // nth-child(3): API Key
            BILLING_DATE: 2,  // nth-child(2): Billing Date
            CHARGE_TYPE: 7,   // nth-child(7): Charge Type
            LISTED_PRICE: 8,  // nth-child(8): Listed Price
            CODE: 6           // nth-child(6): Model (Code)
        }
    };

    // LocalStorageキー
    const STORAGE_KEY = 'zai_billing_aggregator_data';
    const API_KEY_MAPPING_KEY = 'zai_billing_aggregator_api_key_mapping';

    // 集計データを格納する変数
    let aggregatedData = [];

    // API Keyのマッピングを管理
    let apiKeyMapping = {};

    // LocalStorageからデータを読み込み
    const loadStoredData = () => {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                if (Array.isArray(parsedData)) {
                    aggregatedData = parsedData;
                    return true;
                }
            }
        } catch (error) {
            console.warn('LocalStorageからのデータ読み込みに失敗しました:', error);
        }
        return false;
    };

    // LocalStorageにデータを保存
    const saveStoredData = () => {
        try {
            const dataString = JSON.stringify(aggregatedData);
            localStorage.setItem(STORAGE_KEY, dataString);
        } catch (error) {
            console.warn('LocalStorageへのデータ保存に失敗しました:', error);
        }
    };

    // LocalStorageのデータをクリア
    const clearStoredData = () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(API_KEY_MAPPING_KEY);
        } catch (error) {
            console.warn('LocalStorageのデータクリアに失敗しました:', error);
        }
    };

    // API Keyマッピングを読み込み
    const loadApiKeyMapping = () => {
        try {
            const storedMapping = localStorage.getItem(API_KEY_MAPPING_KEY);
            if (storedMapping) {
                apiKeyMapping = JSON.parse(storedMapping);
            }
        } catch (error) {
            console.warn('API Keyマッピングの読み込みに失敗しました:', error);
        }
    };

    // API Keyマッピングを保存
    const saveApiKeyMapping = () => {
        try {
            localStorage.setItem(API_KEY_MAPPING_KEY, JSON.stringify(apiKeyMapping));
        } catch (error) {
            console.warn('API Keyマッピングの保存に失敗しました:', error);
        }
    };

    // API Keyから表示用の短縮名を生成
    const getApiKeyDisplayName = (apiKey) => {
        if (!apiKeyMapping[apiKey]) {
            const prefix = apiKey.substring(0, 3);
            apiKeyMapping[apiKey] = `${prefix}...`;
        }
        return apiKeyMapping[apiKey];
    };

    // トークン数を数値に変換
    const parseTokenValue = (text) => {
        if (!text || text.trim() === '0$') return 0;

        // "token", "kToken" の単位を処理
        let value = text.replace(/\s*token$/i, '');

        // kTokenを1000倍に変換
        if (value.includes('kToken')) {
            value = value.replace(/kToken/i, '');
            return parseFloat(value) * 1000;
        }

        return parseFloat(value) || 0;
    };

    // 価格を数値に変換
    const parsePriceValue = (text) => {
        if (!text || text.trim() === '0$' || text.trim() === '') return 0;
        return parseFloat(text.replace(/[^0-9.-]/g, '')) || 0;
    };

    // 現在のページのデータを収集
    const collectCurrentPageData = () => {
        const table = document.querySelector('div.w-full > div > table');
        if (!table) {
            return [];
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) {
            return [];
        }

        const rows = tbody.querySelectorAll('tr');

        const pageData = [];

        rows.forEach((row) => {
            try {
                const cells = row.querySelectorAll('td');
                if (cells.length < 8) {
                    return;
                }

                const originalApiKey = cells[CONFIG.TARGET_COLUMNS.API_KEY - 1]?.textContent?.trim() || '';
                const billingDate = cells[CONFIG.TARGET_COLUMNS.BILLING_DATE - 1]?.textContent?.trim() || '';
                const chargeType = cells[CONFIG.TARGET_COLUMNS.CHARGE_TYPE - 1]?.textContent?.trim() || '';
                const listedPriceText = cells[CONFIG.TARGET_COLUMNS.LISTED_PRICE - 1]?.textContent?.trim() || '';
                const code = cells[CONFIG.TARGET_COLUMNS.CODE - 1]?.textContent?.trim() || '';

                // 使用量の列（USAGE）を取得 - 10番目の列
                const usageText = cells[9]?.textContent?.trim() || '0 token';
                const usageValue = parseTokenValue(usageText);

                // 請求額の列（Amount）を取得 - 17番目の列
                const amountText = cells[16]?.textContent?.trim() || '0$';
                const amountValue = parsePriceValue(amountText);

                // API Callsの列を取得 - 16番目の列
                const apiCallsText = cells[15]?.textContent?.trim() || '0';
                const apiCallsValue = parseInt(apiCallsText) || 0;

                if (originalApiKey && chargeType) {
                    const apiKeyId = getApiKeyDisplayName(originalApiKey);
                    pageData.push({
                        apiKey: apiKeyId,
                        originalApiKey,
                        billingDate,
                        code,
                        chargeType,
                        listedPrice: listedPriceText,
                        usage: usageValue,
                        usageText,
                        amount: amountValue,
                        apiCalls: apiCallsValue,
                        rawData: row
                    });
                }
            } catch (error) {
                console.warn('行の処理中にエラー:', error);
            }
        });

        return pageData;
    };

    // 通知ポップアップを表示
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background-color: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            z-index: 10000000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            max-width: 400px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease-out;
        `;

        // アニメーションを定義
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);

        notification.textContent = message;
        document.body.appendChild(notification);

        // 3秒後に削除
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    };

    // データを集計
    const aggregateData = () => {
        // 保存されたデータがあれば読み込む
        if (aggregatedData.length === 0) {
            const loaded = loadStoredData();
            if (loaded && aggregatedData.length > 0) {
                showNotification(`${aggregatedData.length}件の保存データを読み込みました`, 'info');
            }
        }

        const currentPageData = collectCurrentPageData();

        if (currentPageData.length === 0) {
            showNotification('集計できるデータがありません', 'error');
            return;
        }

        // 既存データとマージ
        currentPageData.forEach(item => {
            const existingIndex = aggregatedData.findIndex(
                existing => existing.apiKey === item.apiKey &&
                    existing.chargeType === item.chargeType &&
                    existing.billingDate === item.billingDate &&
                    existing.code === item.code
            );

            if (existingIndex >= 0) {
                // 既存データを新しいデータで置き換え（rawDataを除外）
                const { rawData, ...cleanItem } = item;
                aggregatedData[existingIndex] = cleanItem;
            } else {
                // 新規データを追加（rawDataプロパティを除外）
                const { rawData, ...cleanItem } = item;
                aggregatedData.push(cleanItem);
            }
        });

        // LocalStorageに保存
        saveStoredData();
        saveApiKeyMapping();

        showNotification(`${currentPageData.length}件のデータを集計しました`, 'success');

    };

    // TOTAL行を追加したデータを生成
    const addTotalRows = (data) => {
        const groupedByApiKeyAndDate = {};

        // API Key、請求日、コードでグループ化
        data.forEach(item => {
            const key = `${item.apiKey}_${item.billingDate}_${item.code}`;
            if (!groupedByApiKeyAndDate[key]) {
                groupedByApiKeyAndDate[key] = [];
            }
            groupedByApiKeyAndDate[key].push(item);
        });

        const result = [];

        Object.keys(groupedByApiKeyAndDate).forEach(key => {
            const items = groupedByApiKeyAndDate[key];
            const totalItem = {
                apiKey: items[0].apiKey,
                billingDate: items[0].billingDate,
                code: items[0].code,
                chargeType: 'TOTAL',
                listedPrice: '-',
                usage: items.reduce((sum, item) => sum + item.usage, 0),
                usageText: 'TOTAL',
                amount: items.reduce((sum, item) => sum + item.amount, 0),
                apiCalls: items.reduce((sum, item) => sum + item.apiCalls, 0),
                rawData: null
            };

            // 個別の行を追加
            result.push(...items);
            // TOTAL行を追加
            result.push(totalItem);
        });

        return result;
    };

    // 集計結果をソート
    const sortData = (data, sortBy, sortOrder) => {
        return [...data].sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'apiKey':
                    aValue = a.apiKey.toLowerCase();
                    bValue = b.apiKey.toLowerCase();
                    break;
                case 'billingDate':
                    aValue = new Date(a.billingDate);
                    bValue = new Date(b.billingDate);
                    break;
                case 'code':
                    aValue = a.code.toLowerCase();
                    bValue = b.code.toLowerCase();
                    break;
                case 'chargeType':
                    // TOTAL行は常に最後に
                    if (a.chargeType === 'TOTAL') aValue = 'ZZZZ';
                    else if (b.chargeType === 'TOTAL') bValue = 'ZZZZ';
                    else {
                        aValue = a.chargeType.toLowerCase();
                        bValue = b.chargeType.toLowerCase();
                    }
                    break;
                case 'usage':
                    aValue = a.usage;
                    bValue = b.usage;
                    break;
                case 'amount':
                    aValue = a.amount;
                    bValue = b.amount;
                    break;
                case 'apiCalls':
                    aValue = a.apiCalls;
                    bValue = b.apiCalls;
                    break;
                default:
                    return 0;
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            } else {
                return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
            }
        });
    };

    // 現在のソート状態
    let currentSortBy = 'apiKey';
    let currentSortOrder = 'asc';

    // Global scope helper
    const getGlobalContext = () => {
        return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    };

    // Chart.jsをロード
    const loadChartJs = () => {
        return new Promise((resolve, reject) => {
            const globalCtx = getGlobalContext();
            if (globalCtx.Chart) {
                resolve(globalCtx.Chart);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => {
                if (globalCtx.Chart) {
                    resolve(globalCtx.Chart);
                } else {
                    reject(new Error('Chart object not found in global context'));
                }
            };
            script.onerror = () => reject(new Error('Chart.jsの読み込みに失敗しました'));
            document.head.appendChild(script);
        });
    };

    // 文字列から色を生成するハッシュ関数
    const stringToColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    };

    // チャート用データを処理
    const processChartData = (data) => {
        const groupedData = {};
        const allDates = new Set();

        data.forEach(item => {
            if (item.billingDate) {
                allDates.add(item.billingDate);

                // グルーピングキー: API Key - Model (Type)
                const key = `${item.apiKey} - ${item.code} (${item.chargeType})`;

                if (!groupedData[key]) {
                    groupedData[key] = {};
                }
                if (!groupedData[key][item.billingDate]) {
                    groupedData[key][item.billingDate] = 0;
                }

                // トークン使用量を加算
                groupedData[key][item.billingDate] += item.usage;
            }
        });

        // 日付でソート
        const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));

        // データセット生成
        const datasets = Object.keys(groupedData).map(key => {
            const dataPoints = sortedDates.map(date => groupedData[key][date] || 0);
            const color = stringToColor(key);

            return {
                label: key,
                data: dataPoints,
                borderColor: color,
                backgroundColor: color, // 凡例用
                borderWidth: 2,
                fill: false, // 塗りつぶしなしで線のみ
                tension: 0.1
            };
        }).filter(dataset => {
            // トークン使用量が全て0のデータセットを除外
            const total = dataset.data.reduce((sum, val) => sum + val, 0);
            return total > 0;
        });

        return {
            labels: sortedDates,
            datasets: datasets
        };
    };

    let currentChart = null;
    const renderChart = (ctx, data) => {
        if (currentChart) {
            currentChart.destroy();
        }

        const globalCtx = getGlobalContext();
        const ChartConstructor = globalCtx.Chart;

        if (!ChartConstructor) {
            console.error('Chart.js not found');
            return;
        }

        currentChart = new ChartConstructor(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Token Usage'
                        },
                        ticks: {
                            callback: (value) => value.toLocaleString()
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        filter: function (tooltipItem) {
                            return tooltipItem.parsed.y > 0;
                        },
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString() + ' token';
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10
                        }
                    }
                }
            }
        });
    };

    // 集計結果を表示
    const showResults = async () => {
        // 保存されたデータがあれば読み込む
        if (aggregatedData.length === 0) {
            const loaded = loadStoredData();
            loadApiKeyMapping();
            if (!loaded || aggregatedData.length === 0) {
                showNotification('表示できる集計データがありません。まず「集計」ボタンを押してください。', 'error');
                return;
            }
            showNotification(`${aggregatedData.length}件の保存データを読み込みました`, 'info');
        }

        try {
            await loadChartJs();
        } catch (e) {
            console.error('Chart load failed', e);
            showNotification('グラフの読み込みに失敗しました: ' + e.message, 'error');
        }

        // TOTAL行を追加してソート実行
        const dataWithTotal = addTotalRows(aggregatedData);
        const sortedData = sortData(dataWithTotal, currentSortBy, currentSortOrder);

        // オーバーレイ作成
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            z-index: 9999998;
        `;

        // モーダル作成
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            border: 2px solid #333;
            border-radius: 10px;
            padding: 20px;
            z-index: 9999999;
            max-height: 80vh;
            overflow: auto;
            width: 80%;
            min-width: 800px;
            box-shadow: 0 6px 30px rgba(0,0,0,0.5);
            color: black;
        `;

        // 総計を計算
        const totalUsage = aggregatedData.reduce((sum, item) => sum + item.usage, 0);
        const totalAmount = aggregatedData.reduce((sum, item) => sum + item.amount, 0);
        const totalApiCalls = aggregatedData.reduce((sum, item) => sum + item.apiCalls, 0);

        // ヘッダー部分
        const header = document.createElement('div');
        header.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #333;">💰 請求データ集計結果</h2>
            <div style="display: flex; gap: 20px; margin-bottom: 15px; font-size: 14px; color: #666;">
                <span>総API Calls: <strong>${totalApiCalls.toLocaleString()}</strong></span>
                <span>総使用量: <strong>${totalUsage.toLocaleString()} token</strong></span>
                <span>総請求額: <strong>$${totalAmount.toFixed(4)}</strong></span>
            </div>
            <div style="margin-bottom: 15px; color: #888; font-size: 12px;">
                現在のソート: <strong>${currentSortBy}</strong> (${currentSortOrder === 'asc' ? '昇順' : '降順'})
            </div>
        `;

        // テーブル作成
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; margin-bottom: 20px;';

        // テーブルヘッダー
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.cssText = 'background-color: #f5f5f5; color: black;';

        const headers = [
            { key: 'apiKey', text: 'API Key' },
            { key: 'billingDate', text: '請求日' },
            { key: 'code', text: 'モデル' },
            { key: 'chargeType', text: '課金タイプ' },
            { key: 'usage', text: '使用量' },
            { key: 'amount', text: '請求額' },
            { key: 'apiCalls', text: 'API Calls' }
        ];

        headers.forEach(headerInfo => {
            const th = document.createElement('th');
            th.style.cssText = 'padding: 10px; text-align: left; border: 1px solid #ddd; cursor: pointer; font-weight: bold; background-color: #f0f0f0; color: black;';
            th.textContent = headerInfo.text;
            th.onclick = () => {
                if (currentSortBy === headerInfo.key) {
                    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortBy = headerInfo.key;
                    currentSortOrder = 'asc';
                }
                document.body.removeChild(overlay);
                showResults();
            };
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // テーブルボディー
        const tbody = document.createElement('tbody');
        sortedData.forEach(item => {
            const row = document.createElement('tr');
            const isTotalRow = item.chargeType === 'TOTAL';
            row.style.cssText = `border-bottom: 1px solid #eee; color: black; ${isTotalRow ? 'background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #333;' : ''}`;

            const cells = [
                `<td style="padding: 8px; border: 1px solid #ddd; color: black; ${!isTotalRow ? 'cursor: pointer;' : ''}" title="${!isTotalRow ? 'クリックでこのAPI Keyをフィルタ' : 'TOTAL行'}">${item.apiKey}</td>`,
                `<td style="padding: 8px; border: 1px solid #ddd; color: black; ${!isTotalRow ? 'cursor: pointer;' : ''}" title="${!isTotalRow ? 'クリックでこの請求日をフィルタ' : 'TOTAL行'}">${item.billingDate}</td>`,
                `<td style="padding: 8px; border: 1px solid #ddd; color: black;">${item.code || ''}</td>`,
                `<td style="padding: 8px; border: 1px solid #ddd; color: ${isTotalRow ? '#0066cc;' : 'black'}; ${!isTotalRow ? 'cursor: pointer;' : ''}" title="${!isTotalRow ? 'クリックでこの課金タイプをフィルタ' : 'TOTAL - OUTPUT, CACHE, INPUTの合計値'}">${item.chargeType}</td>`,
                `<td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: ${isTotalRow ? '#0066cc;' : 'black'};">${item.usage.toLocaleString()} token</td>`,
                `<td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: ${isTotalRow ? '#0066cc;' : 'black'};">$${item.amount.toFixed(4)}</td>`,
                `<td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: ${isTotalRow ? '#0066cc;' : 'black'};">${item.apiCalls.toLocaleString()}</td>`
            ];

            row.innerHTML = cells.join('');

            // クリックイベントを追加
            const apiKeyCell = row.querySelector('td:nth-child(1)');
            const billingDateCell = row.querySelector('td:nth-child(2)');
            const chargeTypeCell = row.querySelector('td:nth-child(4)');

            apiKeyCell.addEventListener('click', (e) => {
                e.stopPropagation();
                const filterValue = item.apiKey;
                const isCurrentlyFiltered = currentFilter === filterValue && currentFilterColumn === 'apiKey';

                if (isCurrentlyFiltered) {
                    // フィルター解除
                    currentFilter = null;
                    currentFilterColumn = null;
                    filterTableRows(tbody, null, null);
                    showNotification('API Keyフィルターを解除しました', 'info');
                } else {
                    // フィルター適用
                    currentFilter = filterValue;
                    currentFilterColumn = 'apiKey';
                    filterTableRows(tbody, filterValue, 'apiKey');
                    showNotification(`API Key "${filterValue}" でフィルタリングしました`, 'info');
                }
            });

            billingDateCell.addEventListener('click', (e) => {
                e.stopPropagation();
                const filterValue = item.billingDate;
                const isCurrentlyFiltered = currentFilter === filterValue && currentFilterColumn === 'billingDate';

                if (isCurrentlyFiltered) {
                    // フィルター解除
                    currentFilter = null;
                    currentFilterColumn = null;
                    filterTableRows(tbody, null, null);
                    showNotification('請求日フィルターを解除しました', 'info');
                } else {
                    // フィルター適用
                    currentFilter = filterValue;
                    currentFilterColumn = 'billingDate';
                    filterTableRows(tbody, filterValue, 'billingDate');
                    showNotification(`請求日 "${filterValue}" でフィルタリングしました`, 'info');
                }
            });

            chargeTypeCell.addEventListener('click', (e) => {
                e.stopPropagation();
                const filterValue = item.chargeType;
                const isCurrentlyFiltered = currentFilter === filterValue && currentFilterColumn === 'chargeType';

                if (isCurrentlyFiltered) {
                    // フィルター解除
                    currentFilter = null;
                    currentFilterColumn = null;
                    filterTableRows(tbody, null, null);
                    showNotification('課金タイプフィルターを解除しました', 'info');
                } else {
                    // フィルター適用
                    currentFilter = filterValue;
                    currentFilterColumn = 'chargeType';
                    filterTableRows(tbody, filterValue, 'chargeType');
                    showNotification(`課金タイプ "${filterValue}" でフィルタリングしました`, 'info');
                }
            });

            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        // 閉じるボタン
        const closeButton = document.createElement('button');
        closeButton.textContent = '閉じる';
        closeButton.style.cssText = `
            padding: 10px 20px;
            background-color: #ef4444;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            float: right;
        `;
        closeButton.onclick = () => document.body.removeChild(overlay);

        // クリアボタン
        const clearButton = document.createElement('button');
        clearButton.textContent = '集計データをクリア';
        clearButton.style.cssText = `
            padding: 10px 20px;
            background-color: #f59e0b;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            float: left;
        `;
        clearButton.onclick = () => {
            if (confirm('集計データをすべてクリアしますか？')) {
                aggregatedData = [];
                clearStoredData();
                document.body.removeChild(overlay);
                showNotification('集計データをクリアしました', 'info');
            }
        };

        // チャートコンテナ作成
        const chartContainer = document.createElement('div');
        chartContainer.style.cssText = 'height: 300px; width: 100%; margin-bottom: 20px;';
        const canvas = document.createElement('canvas');
        chartContainer.appendChild(canvas);

        // チャート描画
        const globalCtx = getGlobalContext();
        if (globalCtx.Chart) {
            const chartData = processChartData(aggregatedData);
            renderChart(canvas.getContext('2d'), chartData);
        } else {
            console.warn('Canvas skipping because Chart is not defined');
        }

        // モーダルの組み立て
        modal.appendChild(header);
        modal.appendChild(chartContainer);
        modal.appendChild(table);
        modal.appendChild(clearButton);
        modal.appendChild(closeButton);

        // オーバーレイにクリックイベント
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        };

        // DOMに追加
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    };

    // ボタンを作成
    const createButton = (text, onClick, backgroundColor = '#3b82f6') => {
        const button = document.createElement('button');
        button.textContent = text;
        button.setAttribute('data-billing-aggregator-button', 'true');

        button.style.cssText = `
            padding: 10px 20px;
            color: black;
            border: 2px solid #fff;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            background-color: ${backgroundColor};
        `;
        button.onclick = onClick;
        return button;
    };

    // フィルター状態を管理する変数
    let currentFilter = null;
    let currentFilterColumn = null;

    // テーブルボディーの行をフィルタリング
    const filterTableRows = (tbody, filterValue, columnKey) => {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            let shouldShow = true;

            if (filterValue) {
                let cellIndex = 0;
                switch (columnKey) {
                    case 'apiKey':
                        cellIndex = 0;
                        break;
                    case 'billingDate':
                        cellIndex = 1;
                        break;
                    case 'chargeType':
                        cellIndex = 3;
                        break;
                    default:
                        shouldShow = true;
                }

                if (cellIndex < cells.length) {
                    const cellText = cells[cellIndex].textContent.trim();
                    shouldShow = cellText === filterValue;
                }
            }

            row.style.display = shouldShow ? '' : 'none';
        });
    };

    // 初期化
    const init = () => {
        // LocalStorageからデータを自動読み込み
        loadStoredData();
        loadApiKeyMapping();
        if (aggregatedData.length > 0) {
            showNotification('読み込みが完了しました', 'info');
        }

        // ボタンコンテナを作成
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 999999;
            display: flex;
            gap: 10px;
            background-color: rgba(255, 255, 255, 0.9);
            padding: 5px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        `;

        // 集計ボタン
        const aggregateButton = createButton('📊 集計', aggregateData, '#10b981');

        // 結果表示ボタン
        const showResultsButton = createButton('📋 結果表示', showResults, '#6366f1');

        // リセットボタン
        const resetData = () => {
            if (confirm('保存されている集計データと表示中のデータをすべてクリアしますか？')) {
                aggregatedData = [];
                clearStoredData();
                showNotification('データをリセットしました', 'success');
            }
        };
        const resetButton = createButton('🔄 リセット', resetData, '#ef4444');

        // イベントリスナーを直接設定（コンテナのクリックイベントを防止）
        aggregateButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            aggregateData();
        });

        showResultsButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showResults();
        });

        resetButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetData();
        });

        // createButtonで設定したonclickをクリア
        aggregateButton.onclick = null;
        showResultsButton.onclick = null;
        resetButton.onclick = null;

        // コンテナにボタンを追加
        buttonContainer.appendChild(aggregateButton);
        buttonContainer.appendChild(showResultsButton);
        buttonContainer.appendChild(resetButton);

        // コンテナに属性を設定してDOMに追加
        buttonContainer.setAttribute('data-billing-container', 'true');
        document.body.appendChild(buttonContainer);

    };

    init();
})();
