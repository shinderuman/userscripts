(function () {
    'use strict';

    const GOOGLE_SEARCH_BASE_URL = 'https://www.google.com/search?q=';

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

    const addSearchIcons = () => {
        // 「」『』を含むタイトル要素のみを対象にする
        const titleElements = document.querySelectorAll('h2.NC-MediaObjectTitle, .NC-MediaObjectTitle');

        titleElements.forEach(titleElement => {
            // 既にアイコンが追加されているかチェック
            if (titleElement.dataset.movieSearchEnhanced) return;

            const videoTitle = titleElement.textContent.trim();

            // 映画タイトルを抽出
            const movieTitle = extractMovieTitle(videoTitle);
            if (!movieTitle) return;

            // 検索アイコンを作成
            const searchIcon = createSearchIcon(movieTitle);

            // タイトル要素に直接アイコンを追加
            titleElement.appendChild(searchIcon);
            titleElement.dataset.movieSearchEnhanced = 'true';

        });
    };

    const initializeYuzukiMovieSeriesEnhancer = () => {
        addSearchIcons();
        new MutationObserver(addSearchIcons).observe(document.body, { childList: true, subtree: true });

        console.log('🚀 結月さん映画シリーズエンハンサーが初期化されました');
        console.log('💡 「結月さん映画を鑑賞する」シリーズに🎬アイコンで配信サイト検索機能を追加しました');
    };

    // 自動初期化
    initializeYuzukiMovieSeriesEnhancer();
})();