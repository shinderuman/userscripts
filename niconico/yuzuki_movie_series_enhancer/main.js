(function () {
    'use strict';

    const GOOGLE_SEARCH_BASE_URL = 'https://www.google.com/search?q=';

    // 定数定義
    const NO_TAG = '未設定';
    const TAGS = ['私は大好き', '私は好き', '嫌いじゃないわね', '嫌いじゃないわね以下', 'その他', NO_TAG];
    const STORAGE_KEY = 'yuzuki_movie_tags';

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
            return tags[videoId] || null;
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

    const getTagIndexByTag = (tag) => {
        const index = TAGS.indexOf(tag);
        return index !== -1 ? index : TAGS.length - 1; // 見つからなければ「--」のインデックス
    };

    const createStyledTagButton = (videoId, currentTag = null) => {
        const tagButton = document.createElement('button');
        const displayTag = currentTag || NO_TAG;
        tagButton.textContent = `🏷️${displayTag}`;
        tagButton.title = 'クリックでタグを変更';
        tagButton.className = CLASS_NAMES.MOVIE_TAG_BUTTON;

        // 現在のタグインデックスをdata属性に保存
        const currentIndex = getTagIndexByTag(currentTag);
        tagButton.dataset.tagIndex = currentIndex.toString();

        // スタイルを適用
        tagButton.style.cssText = `
            display: inline-block;
            margin-left: 6px;
            margin-right: 8px;
            padding: 2px 6px;
            background-color: #e8f4ff;
            border-radius: 3px;
            font-size: 11px;
            color: #333;
            border: 1px solid #b3d9ff;
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
            const nextIndex = (currentIndex + 1) % TAGS.length;
            const newTag = TAGS[nextIndex];

            // タグを保存
            saveTag(videoId, newTag);

            // ボタン表示とdata属性を更新
            tagButton.textContent = `🏷️${newTag}`;
            tagButton.dataset.tagIndex = nextIndex.toString();
        });
    };

    const createTagButton = (videoId, currentTag = null) => {
        const tagButton = createStyledTagButton(videoId, currentTag);
        handleTagButtonClick(tagButton, videoId);
        return tagButton;
    };

    const updateVideoPageTag = (tag, h1Element) => {
        // 既存のタグ表示を削除
        const existingTag = h1Element.querySelector(`.${CLASS_NAMES.MOVIE_TAG_DISPLAY}`);
        if (existingTag) {
            existingTag.remove();
        }

        // 新しいタグを表示
        if (tag && tag !== NO_TAG) {
            const tagDisplay = document.createElement('span');
            tagDisplay.className = CLASS_NAMES.MOVIE_TAG_DISPLAY;
            tagDisplay.textContent = ` [${tag}]`;
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

                const existingButton = h1Element.parentElement.querySelector(`.${CLASS_NAMES.MOVIE_TAG_BUTTON}`);
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

        titleElements.forEach(titleElement => {
            // 既にアイコンが追加されているかチェック
            if (titleElement.dataset[CLASS_NAMES.MOVIE_SEARCH_ENHANCED]) return;

            const videoTitle = titleElement.textContent.trim();

            // 映画タイトルを抽出
            const movieTitle = extractMovieTitle(videoTitle);
            if (!movieTitle) return;

            // videoIdを取得
            const videoLink = titleElement.closest('a');
            const videoId = videoLink ? videoLink.href.match(/(sm\d+)/)?.[1] : null;

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
                const seriesLink = document.querySelector(SELECTORS.SERIES_LINK);
                if (seriesLink) {
                    setupVideoPage();
                    console.log('🚀 結月さん映画シリーズエンハンサーが初期化されました（動画ページ）');
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
            console.log('🚀 結月さん映画シリーズエンハンサーが初期化されました（シリーズページ）');
            console.log('💡 「結月さん映画を鑑賞する」シリーズに🎬アイコンで配信サイト検索機能と🏷️タグ機能を追加しました');
        }
    };

    // 自動初期化
    initializeYuzukiMovieSeriesEnhancer();
})();
