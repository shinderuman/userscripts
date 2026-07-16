(function () {
    'use strict';

    const GOOGLE_SEARCH_BASE_URL = 'https://www.google.com/search?q=';

    // 定数定義
    const STORAGE_KEY = 'yuzuki_movie_tags';

    // タグ情報を一元管理（インデックスベース）
    const TAG_COLORS = [
        {
            name: '私は大好き',
            backgroundColor: '#ff6b6b',
            borderColor: '#ff5252',
            color: '#fff'
        },
        {
            name: '私は好き',
            backgroundColor: '#ffa726',
            borderColor: '#ff9800',
            color: '#fff'
        },
        {
            name: '嫌いじゃないわね',
            backgroundColor: '#66bb6a',
            borderColor: '#4caf50',
            color: '#fff'
        },
        {
            name: '嫌いじゃないわね以下',
            backgroundColor: '#42a5f5',
            borderColor: '#2196f3',
            color: '#fff'
        },
        {
            name: 'その他',
            backgroundColor: '#ab47bc',
            borderColor: '#9c27b0',
            color: '#fff'
        },
        {
            name: '未設定',
            backgroundColor: '#e8f4ff',
            borderColor: '#b3d9ff',
            color: '#333'
        }
    ];

    // セレクタ定数
    const SELECTORS = {
        H1_VIDEO_TITLE: 'h1.fs_xl.fw_bold',
        SERIES_LINK: 'a[data-anchor-href="/series/351508"]',
        SERIES_TITLE: 'h2.NC-MediaObjectTitle, .NC-MediaObjectTitle'
    };

    // クラス名定数
    const CLASS_NAMES = {
        MOVIE_TAG_BUTTON: 'yuzuki-movie-tag-button',
        MOVIE_TAG_DISPLAY: 'yuzuki-movie-tag-display',
        MOVIE_SEARCH_ENHANCED: 'movieSearchEnhanced'
    };

    // LocalStorage操作
    const getVideoId = () => {
        const urlMatch = window.location.href.match(/(sm\d+)/);
        return urlMatch ? urlMatch[1] : null;
    };

    const getSavedTag = (videoId) => {
        try {
            const tags = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return tags[videoId] !== undefined ? tags[videoId] : null;
        } catch (e) {
            console.warn('タグの読み取りに失敗しました:', e);
            return null;
        }
    };

    const saveTag = (videoId, tag) => {
        try {
            const tags = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            tags[videoId] = tag;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
        } catch (e) {
            console.warn('タグの保存に失敗しました:', e);
        }
    };

    const extractMovieTitle = (videoTitle) => {
        const match = videoTitle.match(/[「『](.+?)[」』]/);
        return match ? match[1].trim() : null;
    };

    const createSearchIcon = (movieTitle) => {
        const searchLink = document.createElement('a');
        searchLink.href = `${GOOGLE_SEARCH_BASE_URL}${encodeURIComponent(movieTitle + ' 配信')}`;
        searchLink.target = '_blank';
        searchLink.rel = 'noopener noreferrer';
        searchLink.textContent = '🎬';
        searchLink.title = `映画「${movieTitle}」の配信サイトを検索`;
        searchLink.className = 'yuzuki-movie-search-icon';

        // スタイルを適用
        searchLink.style.cssText = `
            display: inline-block;
            margin-left: 6px;
            padding: 2px 4px;
            background-color: #f8f8f8;
            border-radius: 3px;
            font-size: 11px;
            text-decoration: none;
            color: #555;
            border: 1px solid #ccc;
            cursor: pointer;
            vertical-align: top;
            line-height: 1.2;
            white-space: nowrap;
        `;

        return searchLink;
    };

    const getTagIndexByTag = (tagIndex) => {
        return typeof tagIndex === 'number' &&
            tagIndex >= 0 &&
            tagIndex < TAG_COLORS.length
            ? tagIndex
            : TAG_COLORS.length - 1; // 無効な場合は未設定のインデックス
    };

    const createStyledTagButton = (currentTag = null) => {
        const tagButton = document.createElement('button');
        const currentIndex = getTagIndexByTag(currentTag);
        const tagData = TAG_COLORS[currentIndex];

        tagButton.textContent = `🏷️${tagData.name}`;
        tagButton.title = 'クリックでタグを変更';
        tagButton.className = CLASS_NAMES.MOVIE_TAG_BUTTON;
        tagButton.dataset.tagIndex = currentIndex.toString();

        // タグに対応する色設定を取得（インデックスベース）
        const tagColor = tagData;

        // スタイルを適用
        tagButton.style.cssText = `
            display: inline-block;
            margin-left: 6px;
            margin-right: 8px;
            padding: 2px 6px;
            background-color: ${tagColor.backgroundColor};
            border-radius: 3px;
            font-size: 11px;
            color: ${tagColor.color};
            border: 1px solid ${tagColor.borderColor};
            cursor: pointer;
            vertical-align: top;
            line-height: 1.2;
            white-space: nowrap;
        `;

        return tagButton;
    };

    const handleTagButtonClick = (tagButton, videoId) => {
        tagButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 現在のタグインデックスをdata属性から取得
            const currentIndex = parseInt(tagButton.dataset.tagIndex);
            const nextIndex = (currentIndex + 1) % TAG_COLORS.length;
            const newTagData = TAG_COLORS[nextIndex];

            // タグを保存
            saveTag(videoId, nextIndex);

            // ボタン表示とdata属性を更新
            tagButton.textContent = `🏷️${newTagData.name}`;
            tagButton.dataset.tagIndex = nextIndex.toString();

            // 背景色とテキスト色を更新
            tagButton.style.backgroundColor = newTagData.backgroundColor;
            tagButton.style.color = newTagData.color;
            tagButton.style.borderColor = newTagData.borderColor;
        });
    };

    const createTagButton = (videoId, currentTag = null) => {
        const tagButton = createStyledTagButton(currentTag);
        handleTagButtonClick(tagButton, videoId);
        return tagButton;
    };

    const updateVideoPageTag = (tag, h1Element) => {
        // 既存のタグ表示を削除
        const existingTag = h1Element.querySelector(
            `.${CLASS_NAMES.MOVIE_TAG_DISPLAY}`
        );
        if (existingTag) {
            existingTag.remove();
        }

        // 新しいタグを表示
        if (
            tag !== null &&
            tag !== undefined &&
            tag !== TAG_COLORS.length - 1
        ) {
            const tagIndex = getTagIndexByTag(tag);
            const tagData = TAG_COLORS[tagIndex];
            const tagDisplay = document.createElement('span');
            tagDisplay.className = CLASS_NAMES.MOVIE_TAG_DISPLAY;
            tagDisplay.textContent = ` [${tagData.name}]`;
            tagDisplay.style.cssText = `
                color: #0066cc;
                font-weight: normal;
                font-size: 0.9em;
            `;
            h1Element.appendChild(tagDisplay);
        }
    };

    const setupVideoPage = () => {
        const videoId = getVideoId();
        if (!videoId) return;

        const savedTag = getSavedTag(videoId);

        const trySetupTagButton = () => {
            const h1Element = document.querySelector(SELECTORS.H1_VIDEO_TITLE);
            if (h1Element) {
                updateVideoPageTag(savedTag, h1Element);

                const existingButton = h1Element.parentElement.querySelector(
                    `.${CLASS_NAMES.MOVIE_TAG_BUTTON}`
                );
                if (existingButton) {
                    existingButton.remove();
                }

                const tagButton = createTagButton(videoId, savedTag);
                h1Element.parentElement.insertBefore(tagButton, h1Element);
                return true;
            }
            return false;
        };

        if (trySetupTagButton()) return;

        const observer = new MutationObserver((mutations, obs) => {
            if (trySetupTagButton()) {
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    };

    const addSearchIcons = () => {
        // 「」『』を含むタイトル要素のみを対象にする
        const titleElements = document.querySelectorAll(SELECTORS.SERIES_TITLE);

        titleElements.forEach((titleElement) => {
            // 既にアイコンが追加されているかチェック
            if (titleElement.dataset[CLASS_NAMES.MOVIE_SEARCH_ENHANCED]) return;

            const videoTitle = titleElement.textContent.trim();

            // 映画タイトルを抽出
            const movieTitle = extractMovieTitle(videoTitle);
            if (!movieTitle) return;

            // videoIdを取得
            const videoLink = titleElement.closest('a');
            const videoId = videoLink
                ? videoLink.href.match(/(sm\d+)/)?.[1]
                : null;

            if (!videoId) return;

            // 既存のタグを取得
            const savedTag = getSavedTag(videoId);

            // 検索アイコンを作成
            const searchIcon = createSearchIcon(movieTitle);

            // タグボタンを作成
            const tagButton = createTagButton(videoId, savedTag);

            // タイトル要素にアイコンとボタンを追加
            titleElement.appendChild(searchIcon);
            titleElement.prepend(tagButton);
            titleElement.dataset[CLASS_NAMES.MOVIE_SEARCH_ENHANCED] = 'true';
        });
    };

    const initializeYuzukiMovieSeriesEnhancer = () => {
        // 特定の動画ページ（結月さん映画シリーズ）の場合は動画ページ用のセットアップを実行
        if (window.location.href.includes('/watch/')) {
            const observer = new MutationObserver(() => {
                const seriesLink = document.querySelector(
                    SELECTORS.SERIES_LINK
                );
                if (seriesLink) {
                    setupVideoPage();
                    console.log(
                        '🚀 結月さん映画シリーズエンハンサーが初期化されました（動画ページ）'
                    );
                    console.log('💡 動画ページに🏷️タグ機能を追加しました');
                    observer.disconnect();
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else if (window.location.href.includes('/series/351508')) {
            // シリーズページの場合のみ検索アイコンを追加
            addSearchIcons();
            const observer = new MutationObserver(addSearchIcons);
            observer.observe(document.body, { childList: true, subtree: true });
            console.log(
                '🚀 結月さん映画シリーズエンハンサーが初期化されました（シリーズページ）'
            );
            console.log(
                '💡 「結月さん映画を鑑賞する」シリーズに🎬アイコンで配信サイト検索機能と🏷️タグ機能を追加しました'
            );
        }
    };

    // 自動初期化
    initializeYuzukiMovieSeriesEnhancer();
})();
