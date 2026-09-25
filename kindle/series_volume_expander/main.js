(function () {
    'use strict';

    const { showToast } = unsafeWindow.KindleCommon;

    const CONFIG = {
        CONTAINER_ID: 'series-volume-expander-container',
        ASIN_INPUT_ID: 'series-volume-expander-asins',
        NEXT_VOLUMES_INPUT_ID: 'series-volume-expander-next-volumes',
        RUN_BUTTON_ID: 'series-volume-expander-run',
        COPY_BUTTON_ID: 'series-volume-expander-copy',
        RESET_BUTTON_ID: 'series-volume-expander-reset',
        TOPBAR_RIGHT_ID: 'topbar-right-component',
        QUERY_SIZE: 50,
        ASIN_PATTERN: /^[A-Z0-9]{10}$/,
        // タイトル末尾の巻数表記のパターン（例: 「(1)」「第3巻」「 2」「COMIC 5」「6」）
        VOLUME_PATTERNS: [
            /[（(]([0-9]+)[）)](?:\s*\([^)]*\))?$/,
            /第?([0-9]+)巻(?:\s*\([^)]*\))?$/,
            /[\s　]([0-9]+)(?:\s*\([^)]*\))?$/,
            /(?:THE COMIC|COMIC)\s*([0-9]+)(?:\s*\([^)]*\))?$/i,
            /([0-9]+)(?:\s*\([^)]*\))?$/
        ]
    };

    let lastResultJson = null;

    const initializeSeriesVolumeExpander = () => {
        setTimeout(initializeExpander, 500);
    };

    const initializeExpander = () => {
        const existingContainer = document.getElementById(CONFIG.CONTAINER_ID);
        if (existingContainer) {
            existingContainer.remove();
        }

        const topbarRight = document.getElementById(CONFIG.TOPBAR_RIGHT_ID);
        if (!topbarRight) {
            console.error('topbar-right-component が見つかりません');
            return;
        }

        const firstChild = topbarRight.firstElementChild;
        if (firstChild) {
            topbarRight.insertBefore(createExpanderInput(), firstChild);
        } else {
            topbarRight.appendChild(createExpanderInput());
        }
    };

    const createExpanderInput = () => {
        const container = document.createElement('div');
        container.id = CONFIG.CONTAINER_ID;
        container.className = 'VURZhsjZdKd3r8Pr5v1fJ';
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: "Amazon Ember", Arial, sans-serif;
        `;

        const asinInput = document.createElement('input');
        asinInput.type = 'text';
        asinInput.id = CONFIG.ASIN_INPUT_ID;
        asinInput.placeholder = '["B0XXXXXXXX","B0YYYYYYYY"]';
        asinInput.title = '続巻を取得したいASINのJSON配列をそのまま貼り付け';
        asinInput.style.cssText = `
            width: 200px;
            height: 32px;
            padding: 4px 6px;
            border: 1px solid #D5D9D9;
            border-radius: 4px;
            font-size: 14px;
            background: #FFFFFF;
        `;

        const volumesLabel = document.createElement('span');
        volumesLabel.textContent = '後続巻数:';
        volumesLabel.style.cssText = `
            font-size: 12px;
            color: #0F1111;
            white-space: nowrap;
        `;

        const nextVolumesInput = document.createElement('input');
        nextVolumesInput.type = 'number';
        nextVolumesInput.id = CONFIG.NEXT_VOLUMES_INPUT_ID;
        nextVolumesInput.min = '0';
        nextVolumesInput.placeholder = '0';
        nextVolumesInput.title =
            '0 = 登録巻以降すべて / 1以上 = 登録巻 + 後続n巻';
        nextVolumesInput.style.cssText = `
            width: 64px;
            height: 32px;
            padding: 4px 6px;
            border: 1px solid #D5D9D9;
            border-radius: 4px;
            font-size: 14px;
            background: #FFFFFF;
        `;

        const runButton = document.createElement('button');
        runButton.id = CONFIG.RUN_BUTTON_ID;
        runButton.textContent = '続巻取得';
        runButton.title = '入力ASINの続巻を取得してクリップボードにコピー';
        runButton.style.cssText = `
            padding: 4px 10px;
            background: #F7F8F8;
            color: #0F1111;
            border: 1px solid #D5D9D9;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
        `;
        runButton.addEventListener('click', handleRunButtonClick);

        const copyButton = document.createElement('button');
        copyButton.id = CONFIG.COPY_BUTTON_ID;
        copyButton.textContent = 'コピー';
        copyButton.title = '最後の実行結果を再度クリップボードにコピー';
        copyButton.style.cssText = `
            padding: 4px 10px;
            background: #F7F8F8;
            color: #0F1111;
            border: 1px solid #D5D9D9;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
        `;
        copyButton.addEventListener('click', handleCopyButtonClick);

        const resetButton = document.createElement('button');
        resetButton.id = CONFIG.RESET_BUTTON_ID;
        resetButton.textContent = '×';
        resetButton.title = '入力をリセット';
        resetButton.style.cssText = `
            width: 24px;
            height: 24px;
            padding: 0;
            background: #F7F8F8;
            color: #565959;
            border: 1px solid #D5D9D9;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        `;
        resetButton.addEventListener('click', resetInputs);
        resetButton.addEventListener('mouseenter', () => {
            resetButton.style.background = '#E3E6E6';
        });
        resetButton.addEventListener('mouseleave', () => {
            resetButton.style.background = '#F7F8F8';
        });

        container.appendChild(asinInput);
        container.appendChild(volumesLabel);
        container.appendChild(nextVolumesInput);
        container.appendChild(runButton);
        container.appendChild(copyButton);
        container.appendChild(resetButton);

        return container;
    };

    const handleRunButtonClick = async () => {
        if (
            lastResultJson &&
            !confirm('既に結果を取得済みです。再取得して結果を上書きしますか？')
        ) {
            return;
        }

        const inputAsins = parseInputAsins(
            document.getElementById(CONFIG.ASIN_INPUT_ID).value
        );

        if (inputAsins.length === 0) {
            showToast('有効なASINが入力されていません', 'error');
            return;
        }

        const nextVolumes = parseNextVolumes(
            document.getElementById(CONFIG.NEXT_VOLUMES_INPUT_ID).value
        );

        if (nextVolumes === null) {
            showToast('後続巻数は0以上の整数を入力してください', 'error');
            return;
        }

        const runButton = document.getElementById(CONFIG.RUN_BUTTON_ID);
        const progressToast = showToast('本棚を取得中...', 'info', 0);
        runButton.disabled = true;
        runButton.textContent = '取得中...';

        try {
            const items = await loadAllItems(progressToast);
            const outputAsins = expandAsins(inputAsins, nextVolumes, items);
            outputResult(outputAsins);
            progressToast.hide();
            showToast(
                `${outputAsins.length}件のASINをコピーしました`,
                'success'
            );
            runButton.textContent = `${outputAsins.length}件コピー`;
        } catch (error) {
            console.error('続巻ASIN展開エラー:', error);
            progressToast.hide();
            showToast(`エラー: ${error.message}`, 'error', 5000);
            runButton.textContent = 'エラー';
        } finally {
            runButton.disabled = false;
        }
    };

    const handleCopyButtonClick = () => {
        if (!lastResultJson) {
            showToast('コピーする結果がありません', 'info');
            return;
        }

        GM_setClipboard(lastResultJson);
        showToast('クリップボードにコピーしました', 'success');
    };

    const parseNextVolumes = (value) => {
        if (value === '') {
            return 0;
        }

        const parsedValue = parseInt(value, 10);

        return Number.isInteger(parsedValue) && parsedValue >= 0
            ? parsedValue
            : null;
    };

    const resetInputs = () => {
        document.getElementById(CONFIG.ASIN_INPUT_ID).value = '';
        document.getElementById(CONFIG.NEXT_VOLUMES_INPUT_ID).value = '';
    };

    const parseInputAsins = (text) => {
        try {
            const values = JSON.parse(text);
            return normalizeAsins(Array.isArray(values) ? values : []);
        } catch (error) {
            console.warn(`JSON配列の解析に失敗: ${error.message}`);
            return [];
        }
    };

    const normalizeAsins = (values) => [
        ...new Set(
            values
                .map(normalizeAsin)
                .filter((asin) => CONFIG.ASIN_PATTERN.test(asin))
        )
    ];

    const normalizeAsin = (value) =>
        String(value ?? '')
            .trim()
            .toUpperCase();

    const loadAllItems = async (progressToast) => {
        let page = await fetchFirstPage();
        const items = [...(page.itemsList ?? [])];
        const seenTokens = new Set();

        while (page.paginationToken) {
            page = await loadNextPage(page, items, seenTokens);
            progressToast.update(`本棚を取得中: ${items.length}件`);
        }

        return items;
    };

    const fetchFirstPage = async () => {
        const response = await fetch(
            `/kindle-library/manga?sortType=acquisition_asc&_=${Date.now()}`
        );

        if (!response.ok) {
            throw new Error(`本棚初回取得失敗: HTTP ${response.status}`);
        }

        return parseFirstPage(await response.text());
    };

    const parseFirstPage = (html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const element = doc.querySelector('#itemViewResponse');

        if (!element) {
            throw new Error('#itemViewResponse が見つかりません');
        }

        return JSON.parse(element.textContent);
    };

    const loadNextPage = async (page, items, seenTokens) => {
        if (seenTokens.has(page.paginationToken)) {
            throw new Error(
                `paginationTokenがループしました: ${page.paginationToken}`
            );
        }

        seenTokens.add(page.paginationToken);

        const nextPage = await fetchNextPage(page);
        items.push(...(nextPage.itemsList ?? []));

        return nextPage;
    };

    const fetchNextPage = async (page) => {
        const response = await fetch(buildNextUrl(page), {
            headers: {
                'validation-token': 'undefined'
            }
        });

        if (!response.ok) {
            throw new Error(`本棚ページング失敗: HTTP ${response.status}`);
        }

        return response.json();
    };

    const buildNextUrl = (page) => {
        const params = new URLSearchParams({
            query: '',
            libraryType: page.libraryType,
            paginationToken: page.paginationToken,
            sortType: 'acquisition_asc',
            querySize: String(CONFIG.QUERY_SIZE),
            _: String(Date.now())
        });

        return `/kindle-library/search?${params}`;
    };

    const expandAsins = (inputAsins, nextVolumes, items) => {
        const byAsin = indexByAsin(items);
        const bySeries = indexBySeries(items);
        const result = new Set();

        inputAsins.forEach((asin) =>
            expandAsin(asin, nextVolumes, byAsin, bySeries).forEach((value) =>
                result.add(value)
            )
        );

        return [...result];
    };

    const indexByAsin = (items) =>
        new Map(items.map((item) => [normalizeAsin(item.asin), item]));

    const indexBySeries = (items) => {
        const index = new Map();

        items.forEach((item) => addSeriesItem(index, item));

        for (const series of index.values()) {
            series.sort((a, b) => a.volume - b.volume);
        }

        return index;
    };

    const addSeriesItem = (index, item) => {
        const asin = normalizeAsin(item.asin);
        const seriesKey = buildSeriesKey(item.title);

        if (!CONFIG.ASIN_PATTERN.test(asin) || !seriesKey) {
            return;
        }

        const series = index.get(seriesKey) ?? [];

        series.push({
            asin,
            title: item.title,
            volume: parseVolume(item.title)
        });

        index.set(seriesKey, series);
    };

    const buildSeriesKey = (title) =>
        parseBaseTitle(title)
            .normalize('NFKC')
            .replace(/\s+/g, '')
            .toLowerCase();

    const parseBaseTitle = (title) =>
        stripTrailingParens(normalizeDigits(cleanTitle(title)))
            .replace(/【電子[^】]*】/g, '')
            .replace(/【デジタル[^】]*】/g, '')
            .replace(/\s*[（(][0-9]+[）)]\s*$/, '')
            .replace(/\s*第?[0-9]+巻\s*$/, '')
            .replace(/\s+(?:THE COMIC|COMIC)\s*[0-9]+\s*$/i, '')
            .replace(/\s*[0-9]+\s*$/, '')
            .trim();

    const stripTrailingParens = (text) => {
        for (;;) {
            const next = text.replace(/\s*[（(][^（）()]*[）)]\s*$/, '');

            if (next === text) {
                return text;
            }

            text = next;
        }
    };

    const normalizeDigits = (value) =>
        String(value ?? '').replace(/[０-９]/g, (digit) =>
            String.fromCharCode(digit.charCodeAt(0) - 0xfee0)
        );

    const cleanTitle = (title) =>
        String(title ?? '')
            .normalize('NFKC')
            .replace(/\s*\(Japanese Edition\)\s*$/i, '')
            .trim();

    const parseVolume = (title) =>
        matchVolume(normalizeDigits(cleanTitle(title)).replace(/\s+$/, '')) ??
        1;

    const matchVolume = (text) => {
        for (const pattern of CONFIG.VOLUME_PATTERNS) {
            const match = text.match(pattern);

            if (match) {
                return Number(match[1]);
            }
        }

        return null;
    };

    const expandAsin = (asin, nextVolumes, byAsin, bySeries) => {
        const source = byAsin.get(asin);

        if (!source) {
            console.warn(`ASINが本棚にありません: ${asin}`);
            return [asin];
        }

        const targets = findTargets(source, nextVolumes, bySeries);

        if (targets.length <= 1) {
            console.warn(`後続巻を検出できません: ${source.title}`);
            return [asin];
        }

        return targets.map((item) => item.asin);
    };

    const findTargets = (source, nextVolumes, bySeries) => {
        const targets = (
            bySeries.get(buildSeriesKey(source.title)) ?? []
        ).filter((item) => item.volume >= parseVolume(source.title));

        return limitTargets(targets, nextVolumes);
    };

    const limitTargets = (targets, nextVolumes) =>
        nextVolumes === 0 ? targets : targets.slice(0, nextVolumes + 1);

    const outputResult = (outputAsins) => {
        const json = JSON.stringify(outputAsins);

        lastResultJson = json;
        console.log(json);
        GM_setClipboard(json);
    };

    initializeSeriesVolumeExpander();
})();
