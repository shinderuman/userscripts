(function () {
    'use strict';

    const CONFIG = {
        SELECTORS: {
            SERIES_LIST: '#cover',
            SERIES_ITEM: 'li._11lsG_chr1kjQD0SLGGyNl',
            VOLUME_COUNTER: '[id^="series-counter-"]'
        },
        FILTER_INPUT_ID: 'volume-filter-input',
        FILTER_CONTAINER_ID: 'volume-filter-container',
        FILTER_MODE_ID: 'volume-filter-mode'
    };

    // フィルターモード（true: 最小, false: 最大）
    let isMinMode = true;

    // フィルター入力フィールドを作成
    const createFilterInput = () => {
        const container = document.createElement('div');
        container.id = CONFIG.FILTER_CONTAINER_ID;
        container.className = 'VURZhsjZdKd3r8Pr5v1fJ';
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: "Amazon Ember", Arial, sans-serif;
        `;

        const modeButton = document.createElement('button');
        modeButton.id = CONFIG.FILTER_MODE_ID;
        modeButton.textContent = '最小:';
        modeButton.title = 'クリックで最小/最大を切り替え';
        modeButton.style.cssText = `
            padding: 4px 6px;
            background: #F7F8F8;
            color: #0F1111;
            border: 1px solid #D5D9D9;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
            min-width: 36px;
        `;

        const input = document.createElement('input');
        input.id = CONFIG.FILTER_INPUT_ID;
        input.type = 'number';
        input.min = '1';
        input.placeholder = '巻数';
        input.style.cssText = `
            width: 150px;
            height: 32px;
            padding: 4px 6px;
            border: 1px solid #D5D9D9;
            border-radius: 4px;
            font-size: 14px;
            background: #FFFFFF;
        `;

        const resetButton = document.createElement('button');
        resetButton.textContent = '×';
        resetButton.title = 'フィルターをリセット';
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

        // モード切り替えボタンのイベント
        modeButton.addEventListener('click', () => {
            if (isMinMode) {
                isMinMode = false;
                modeButton.textContent = '最大:';
                modeButton.style.background = '#E3F2FD';
            } else {
                isMinMode = true;
                modeButton.textContent = '最小:';
                modeButton.style.background = '#F7F8F8';
            }

            filterSeries();
        });

        // リセットボタンのイベント
        resetButton.addEventListener('click', () => {
            input.value = '';
            filterSeries();
        });

        resetButton.addEventListener('mouseenter', () => {
            resetButton.style.background = '#E3E6E6';
        });

        resetButton.addEventListener('mouseleave', () => {
            resetButton.style.background = '#F7F8F8';
        });

        input.addEventListener('input', filterSeries);

        container.appendChild(modeButton);
        container.appendChild(input);
        container.appendChild(resetButton);

        return container;
    };

    // シリーズをフィルタリング
    const filterSeries = () => {
        const filterValue = document.getElementById(CONFIG.FILTER_INPUT_ID).value;
        const targetVolumes = filterValue ? parseInt(filterValue) : 0;

        const seriesItems = document.querySelectorAll(CONFIG.SELECTORS.SERIES_ITEM);

        seriesItems.forEach(item => {
            const volumeCounter = item.querySelector(CONFIG.SELECTORS.VOLUME_COUNTER);
            if (volumeCounter) {
                item.style.display = shouldShowItem(parseInt(volumeCounter.textContent.trim()), targetVolumes, isMinMode) ? '' : 'none';
            }
        });
    };

    const shouldShowItem = (volumeCount, targetVolumes, isMinMode) => {
        if (targetVolumes === 0) {
            return true;
        }

        if (isMinMode) {
            return volumeCount >= targetVolumes;
        }

        return volumeCount <= targetVolumes;
    };

    // フィルターUIを初期化
    const initializeFilter = () => {
        // 既存のフィルターコンテナを削除
        const existingContainer = document.getElementById(CONFIG.FILTER_CONTAINER_ID);
        if (existingContainer) {
            existingContainer.remove();
        }

        // topbar-right-componentを探す
        const topbarRight = document.getElementById('topbar-right-component');
        if (!topbarRight) {
            console.error('topbar-right-component が見つかりません');
            return;
        }

        // 新しいフィルターUIを作成
        const filterContainer = createFilterInput();

        // topbar-right-componentの最初の子要素の前に挿入
        const firstChild = topbarRight.firstElementChild;
        if (firstChild) {
            topbarRight.insertBefore(filterContainer, firstChild);
        } else {
            topbarRight.appendChild(filterContainer);
        }

        console.log('📖 Kindle Library Volume Filter が初期化されました');
        console.log('💡 トップバーの巻数フィールドに最小巻数を入力してフィルタリングできます');
    };

    // シリーズリストの変更を監視
    const monitorSeriesList = () => {
        const observer = new MutationObserver(() => {
            setTimeout(filterSeries, 100);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    };

    // 初期化処理
    const initializeLibraryVolumeFilter = () => {
        setTimeout(() => {
            initializeFilter();
            monitorSeriesList();
        }, 500);
    };

    // グローバル関数として公開
    unsafeWindow.initializeLibraryVolumeFilter = initializeLibraryVolumeFilter;

    // 自動初期化
    initializeLibraryVolumeFilter();
})();