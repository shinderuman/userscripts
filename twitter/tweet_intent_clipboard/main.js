(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        INTENT_PATTERNS,
        isIntentUrl,
        extractIntentParams,
        showToast,
        copyToClipboard
    } = unsafeWindow.TwitterCommon;

    const handleIntentClick = async (url) => {
        const { text, url: intentUrl, hashtags } = extractIntentParams(url);

        if (!intentUrl && !/https?:\/\/[^\s]+/.test(text)) {
            showToast('Error', 'Error: The URL parameter is missing or empty, and no URL is found in the text.', null, '#e74c3c', '#c0392b');
            return;
        }

        const fullText = `
${text}
${intentUrl}
${hashtags}
        `.trim() + '\n\n';

        const success = await copyToClipboard(fullText);
        if (success) {
            showToast('X Intent Copier', fullText, url);
        }
    };

    // 基本のintent URLリンク検出
    const handleDirectIntentLink = (event) => {
        const selector = INTENT_PATTERNS.map(pattern => `a[href*="${pattern}"]`).join(', ');
        const target = event.target.closest(selector);
        if (target) {
            event.preventDefault();
            event.stopPropagation();
            handleIntentClick(target.href);
            return true;
        }
        return false;
    };

    // 汎用的なTwitterボタンの検出
    const handleTwitterButton = (event) => {
        const button = event.target.closest('button');
        if (button && isLikelyTwitterButton(button)) {
            // 即座にイベントを停止して独自処理を実行
            event.preventDefault();
            event.stopPropagation();

            const pageTitle = document.title || '';
            const pageUrl = window.location.href;
            const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent(pageUrl)}`;
            handleIntentClick(intentUrl);

            return true;
        }

        return false;
    };

    // buttonがTwitter関連かどうかを判定
    const isLikelyTwitterButton = (button) => {
        const text = button.textContent?.toLowerCase() || '';
        const className = button.className.toLowerCase();
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        const dataTestId = button.getAttribute('data-testid')?.toLowerCase() || '';

        // data-testid="twitter"の場合は確実にTwitterボタン
        if (dataTestId === 'twitter') {
            return true;
        }

        // Twitter関連のキーワードをチェック
        const twitterKeywords = ['twitter', 'tweet', 'ツイート', 'post', 'ポスト', 'share', 'シェア'];

        return twitterKeywords.some(keyword =>
            text.includes(keyword) ||
            className.includes(keyword) ||
            ariaLabel.includes(keyword)
        );
    };

    // AddToAnyのXボタンの検出
    const handleAddToAnyXButton = (event) => {
        const link = event.target.closest('a.a2a_button_x');
        if (link && link.href.includes('addtoany.com/add_to/x')) {
            event.preventDefault();
            event.stopPropagation();

            const url = new URL(link.href);
            const linkUrl = decodeURIComponent(url.searchParams.get('linkurl') || '');
            const linkName = decodeURIComponent(url.searchParams.get('linkname') || '');

            // intent URL形式に変換
            const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(linkName)}&url=${encodeURIComponent(linkUrl)}`;
            handleIntentClick(intentUrl);
            return true;
        }
        return false;
    };

    // シンプルなTwitterシェアボタンの検出
    const handleGenericTwitterShare = (event) => {
        const shareElement = event.target.closest('.twitter, [onclick*="twitter"]');
        if (shareElement &&
            (shareElement.className.includes('twitter') ||
                shareElement.onclick?.toString().includes('twitter'))) {

            event.preventDefault();
            event.stopPropagation();

            // ページ情報からintent URLを生成
            const pageTitle = document.title || '';
            const pageUrl = window.location.href;
            const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent(pageUrl)}`;

            handleIntentClick(intentUrl);
            return true;
        }
        return false;
    };

    const initializeIntentCopier = () => {
        // クリックイベントリスナー
        document.addEventListener('click', (event) => {
            // 優先度順に処理
            if (handleDirectIntentLink(event)) return;
            if (handleAddToAnyXButton(event)) return;
            if (handleTwitterButton(event)) return;
            if (handleGenericTwitterShare(event)) return;
        }, true);

        // window.openのオーバーライド
        const originalOpen = window.open;
        window.open = function (url, ...args) {
            if (url && isIntentUrl(url)) {
                handleIntentClick(url);
                return null;
            }
            return originalOpen.apply(this, [url, ...args]);
        };

        console.log('🚀 Twitter Intent Copier が初期化されました');
    };

    // グローバル関数として公開
    unsafeWindow.initializeIntentCopier = initializeIntentCopier;

    // 自動初期化
    initializeIntentCopier();
})();