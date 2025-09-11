(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        ImageCache,
        DeferredMutationObserver
    } = unsafeWindow.MastodonCommon;

    const CONFIG = {
        TARGET_COLUMN_LABEL: '#StabilityAI',
        INSERT_BEFORE_LABEL: 'ホーム',
        COLUMN_SPLIT_COUNT: 3,
        COLUMN_CLASS: 'split-column',
        KENJI_API_ENDPOINT: 'https://kenji.asmodeus.jp/proxy/api/v1/image/info/',
        KENJI_IMAGE_BASE_URL: 'https://kenji.asmodeus.jp/proxy_image/post/t/',
        OURT_IMAGE_BASE_URL: 'https://img.ourt-ai.work/post/t/',
        EXPIRATION_TIME: 24 * 60 * 60 * 1000 * 7
    };

    const rules = [{
        'removeContent': {
            'accounts': [
                '@pose@mstdn.jp'
            ],
            'func': (article) => {
                article.querySelector('div.status__content.status__content--with-action')?.remove();
            }
        },
        'removeArticle': {
            'accounts': [],
            'func': (article) => {
                if (article.querySelector('div.media-gallery')) return;
                if (article.querySelector('a[href^="https://ourt-ai.work/image/"]')) return;
                article.remove();
            }
        },
        'fetchOurtAI': {
            'accounts': [
            ],
            'func': (article) => {
                if (article.querySelector('div.media-gallery')) return;

                const link = article.querySelector('a[href^="https://ourt-ai.work/image/"]');
                if (!link) return;

                const match = link.href.match(/https:\/\/ourt-ai\.work\/image\/(.+)/);
                if (!match) return;

                fetchOurtAI(match[1]).then((json) => {
                    appendMediaGallery(article, json.detail);
                });
            }
        }
    }];

    const updateSplitColumns = (sourceColumn) => {
        document.querySelectorAll(`.${CONFIG.COLUMN_CLASS}`).forEach(column => column.remove());

        for (let i = CONFIG.COLUMN_SPLIT_COUNT - 1; i >= 0; i--) {
            const newColumn = sourceColumn.cloneNode(true);
            newColumn.classList.add(CONFIG.COLUMN_CLASS);
            newColumn.ariaLabel = '';

            newColumn.querySelectorAll('article').forEach((article, index) => {
                if (index % CONFIG.COLUMN_SPLIT_COUNT !== i) {
                    article.remove();
                    return;
                }

                rules.forEach((ruleSet) => {
                    Object.values(ruleSet).forEach((rule) => {
                        if (rule.accounts.length === 0 || rule.accounts.includes(article.querySelector('span.display-name__account')?.textContent.trim())) {
                            rule.func(article);
                        }
                    });
                });
            });

            sourceColumn.parentElement.insertBefore(newColumn, document.querySelector(`div[aria-label="${CONFIG.INSERT_BEFORE_LABEL}"]`).nextSibling);
        }

        sourceColumn.parentElement.appendChild(sourceColumn);
    };

    const fetchOurtAI = async (id) => {
        const imageCache = new ImageCache();
        const cachedData = await imageCache.getCachedData(id);
        if (cachedData) return cachedData;

        try {
            const response = await fetch(`${CONFIG.KENJI_API_ENDPOINT}${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const jsonData = await response.json();
            await imageCache.saveToIndexedDB(id, jsonData);
            return jsonData;
        } catch (error) {
            console.error('Error fetching or parsing:', error);
            return null;
        }
    };

    const appendMediaGallery = async (articleElement, imageDetails) => {
        const imageCache = new ImageCache();
        const mediaGallery = document.createElement('div');
        mediaGallery.className = `media-gallery media-gallery--layout-${imageDetails.length}`;
        mediaGallery.style.display = 'block';

        for (const imageDetail of imageDetails) {
            const kenjiImageUrl = `${CONFIG.KENJI_IMAGE_BASE_URL}${imageDetail.id}_m.webp`;
            const ourtImageUrl = `${CONFIG.OURT_IMAGE_BASE_URL}${imageDetail.id}_m.webp`;

            let blobImage = await imageCache.getCachedData(kenjiImageUrl);
            if (!blobImage) {
                try {
                    const response = await fetch(kenjiImageUrl);
                    blobImage = await response.blob();
                    await imageCache.saveToIndexedDB(kenjiImageUrl, blobImage);
                } catch (error) {
                    console.error('Error fetching image or saving to IndexedDB:', error);
                    continue;
                }
            }

            const mediaGalleryItem = createMediaGalleryItem(blobImage, ourtImageUrl);
            mediaGallery.appendChild(mediaGalleryItem);
        }

        articleElement.querySelector('div.status__content.status__content--with-action')?.insertAdjacentElement('afterend', mediaGallery);
        articleElement.querySelector('a.status-card')?.remove();
    };

    const createMediaGalleryItem = (blobImage, ourtImageUrl) => {
        const mediaGalleryItem = document.createElement('div');
        mediaGalleryItem.className = 'media-gallery__item media-gallery__item--tall';

        const canvas = document.createElement('canvas');
        canvas.className = 'media-gallery__preview';
        canvas.width = 32;
        canvas.height = 32;

        const thumbnailLink = document.createElement('a');
        thumbnailLink.className = 'media-gallery__item-thumbnail';
        thumbnailLink.href = ourtImageUrl;
        thumbnailLink.target = '_blank';
        thumbnailLink.rel = 'noopener noreferrer';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(blobImage);
        img.srcset = `${URL.createObjectURL(blobImage)} 480w`;
        img.sizes = '164px';
        img.style.objectPosition = '50% 50%';

        thumbnailLink.appendChild(img);
        mediaGalleryItem.appendChild(canvas);
        mediaGalleryItem.appendChild(thumbnailLink);

        return mediaGalleryItem;
    };

    const initializeColumnSplitter = () => {
        const mainMutationObserver = new MutationObserver(() => {
            const sourceColumn = document.querySelector(`div[aria-label="${CONFIG.TARGET_COLUMN_LABEL}"]`);
            if (sourceColumn) {
                mainMutationObserver.disconnect();

                const columnMutationObserver = new DeferredMutationObserver(() => {
                    [...document.querySelectorAll(`div[aria-label="${CONFIG.TARGET_COLUMN_LABEL}"] article button.link-button`)].filter(button => button.textContent.trim() === '続きを表示').forEach(button => button.click());
                    [...document.querySelectorAll(`div[aria-label="${CONFIG.TARGET_COLUMN_LABEL}"] button.media-gallery__actions__pill`)].filter(button => button.textContent.trim() === '隠す').forEach(button => button.remove());
                    [...document.querySelectorAll(`div[aria-label="${CONFIG.TARGET_COLUMN_LABEL}"] button.media-gallery__alt__label`)].forEach(button => button.remove());

                    updateSplitColumns(sourceColumn);
                });
                columnMutationObserver.observe(sourceColumn, { childList: true, subtree: true });
            }
        });

        mainMutationObserver.observe(document.body, { childList: true, subtree: true });
    };

    // グローバル関数として公開
    unsafeWindow.initializeColumnSplitter = initializeColumnSplitter;

    // 自動初期化
    initializeColumnSplitter();
})();