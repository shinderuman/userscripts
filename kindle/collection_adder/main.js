(function () {
    'use strict';

    const { showToast } = unsafeWindow.KindleCommon;

    const CONFIG = {
        PANEL_ID: 'collection-adder-panel',
        COLLECTION_ID_INPUT_ID: 'collection-adder-collection-id',
        ASIN_INPUT_ID: 'collection-adder-asins',
        RUN_BUTTON_ID: 'collection-adder-run',
        ASIN_PATTERN: /^[A-Z0-9]{10}$/,
        BATCH_SIZE: 10,
        BATCH_DELAY_MS: 1200,
        STYLES: {
            PANEL: {
                position: 'fixed',
                bottom: '80px',
                right: '10px',
                zIndex: '9999',
                padding: '10px',
                background: '#f0f0f0',
                border: '1px solid #aaa',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'sans-serif',
                width: '220px'
            },
            INPUT: {
                width: '100%',
                padding: '4px',
                boxSizing: 'border-box',
                marginBottom: '8px'
            },
            TEXTAREA: {
                width: '100%',
                height: '100px',
                padding: '4px',
                boxSizing: 'border-box',
                marginBottom: '8px'
            },
            BUTTON: {
                width: '100%',
                padding: '8px',
                background: '#ff9900',
                border: '1px solid #aaa',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'white'
            }
        }
    };

    const initializeCollectionAdder = () => {
        if (document.getElementById(CONFIG.PANEL_ID)) {
            return;
        }

        createControlPanel();
    };

    const createControlPanel = () => {
        const panel = document.createElement('div');
        panel.id = CONFIG.PANEL_ID;
        Object.assign(panel.style, CONFIG.STYLES.PANEL);

        const collectionIdLabel = document.createElement('label');
        collectionIdLabel.textContent = 'CollectionID:';
        collectionIdLabel.style.display = 'block';
        collectionIdLabel.style.marginBottom = '4px';

        const collectionIdInput = document.createElement('input');
        collectionIdInput.type = 'text';
        collectionIdInput.id = CONFIG.COLLECTION_ID_INPUT_ID;
        collectionIdInput.placeholder = 'e460003c-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        collectionIdInput.value = getCollectionIdFromUrl();
        Object.assign(collectionIdInput.style, CONFIG.STYLES.INPUT);

        const asinLabel = document.createElement('label');
        asinLabel.textContent = 'ASIN（JSON配列）:';
        asinLabel.style.display = 'block';
        asinLabel.style.marginBottom = '4px';

        const asinInput = document.createElement('textarea');
        asinInput.id = CONFIG.ASIN_INPUT_ID;
        asinInput.placeholder = '["B0XXXXXXXX","B0YYYYYYYY"]';
        Object.assign(asinInput.style, CONFIG.STYLES.TEXTAREA);

        const runButton = document.createElement('button');
        runButton.id = CONFIG.RUN_BUTTON_ID;
        runButton.textContent = '➕ 追加';
        Object.assign(runButton.style, CONFIG.STYLES.BUTTON);
        runButton.addEventListener('click', handleAddButtonClick);

        panel.appendChild(collectionIdLabel);
        panel.appendChild(collectionIdInput);
        panel.appendChild(asinLabel);
        panel.appendChild(asinInput);
        panel.appendChild(runButton);

        document.body.appendChild(panel);
    };

    const getCollectionIdFromUrl = () => {
        const match = window.location.pathname.match(
            /\/collectionContent\/[^/]+\/([^/]+)/
        );

        return match ? match[1] : '';
    };

    const handleAddButtonClick = async () => {
        const collectionId = document
            .getElementById(CONFIG.COLLECTION_ID_INPUT_ID)
            .value.trim();

        if (!collectionId) {
            showToast('CollectionIDが入力されていません', 'error');
            return;
        }

        const inputAsins = parseInputAsins(
            document.getElementById(CONFIG.ASIN_INPUT_ID).value
        );

        if (inputAsins.length === 0) {
            showToast('有効なASINが入力されていません', 'error');
            return;
        }

        const runButton = document.getElementById(CONFIG.RUN_BUTTON_ID);
        const progressToast = showToast('コレクションに追加中...', 'info', 0);
        runButton.disabled = true;
        runButton.textContent = '追加中...';

        try {
            await addAsinsToCollection(inputAsins, collectionId, progressToast);
            progressToast.hide();
            showToast(`${inputAsins.length}件を追加しました`, 'success');
            runButton.textContent = `追加しました（${inputAsins.length}件）`;
        } catch (error) {
            console.error('コレクション追加エラー:', error);
            progressToast.hide();
            showToast(`エラー: ${error.message}`, 'error', 5000);
            runButton.textContent = 'エラーが発生しました';
        } finally {
            runButton.disabled = false;
        }
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

    const getCsrfToken = () =>
        unsafeWindow.csrfToken ||
        unsafeWindow.mycdConfig?.csrfToken ||
        document.querySelector('input[name="csrfToken"]')?.value;

    const addAsinsToCollection = async (
        inputAsins,
        collectionId,
        progressToast
    ) => {
        const csrfToken = getCsrfToken();

        if (!csrfToken) {
            throw new Error('csrfTokenが取得できません');
        }

        const batches = chunkAsins(inputAsins);

        for (let i = 0; i < batches.length; i++) {
            progressToast.update(`追加中 ${i + 1}/${batches.length}バッチ`);
            await requestAdd(batches[i], csrfToken, collectionId);

            if (i < batches.length - 1) {
                await sleep(CONFIG.BATCH_DELAY_MS);
            }
        }
    };

    const chunkAsins = (asins) =>
        Array.from(
            { length: Math.ceil(asins.length / CONFIG.BATCH_SIZE) },
            (_, index) =>
                asins.slice(
                    index * CONFIG.BATCH_SIZE,
                    (index + 1) * CONFIG.BATCH_SIZE
                )
        );

    const requestAdd = async (batch, csrfToken, collectionId) => {
        const response = await fetch('/hz/mycd/ajax', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: buildRequestBody(batch, csrfToken, collectionId)
        });

        const text = await response.text();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
        }
    };

    const buildRequestBody = (batch, csrfToken, collectionId) =>
        new URLSearchParams({
            clientId: 'MYCD_WebService',
            csrfToken,
            data: JSON.stringify(buildRequestData(batch, collectionId))
        });

    const buildRequestData = (batch, collectionId) => ({
        param: {
            AddContentToCollection: {
                collectionList: [{ collectionId }],
                contentList: batch.map((asin) => ({ asin })),
                categoryList: batch.map(() => ({ category: 'KindleEBook' }))
            }
        }
    });

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    initializeCollectionAdder();
})();
