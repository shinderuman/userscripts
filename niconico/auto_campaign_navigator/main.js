(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const { showNotification, observeDOM } = unsafeWindow.NiconicoCommon;

    const CONFIG = {
        CAMPAIGN_KEYWORDS: [
            '1日1回無料',
            '毎日無料',
            '無料の福引で',
            '推し動画推薦',
            '麺料理動画を',
            '動画ｱﾜｰﾄﾞ',
            '広告を見ると',
            '一日一回無料',
            '1日1回',
            '「桃那のな」',
            '踊コレ動画を\n応援します！',
            '超会議応援！',
            '推しﾀｸﾞ動画が',
            '１日１回無料'
        ],
        ADDITIONAL_URLS: [],
        LINK_OPEN_DELAY_MS: 1000
    };

    const openedLinks = new Set();
    let isNavigationCancelled = false;
    let debounceTimeout = null;

    const addClickCancelListener = () => {
        document.addEventListener('click', () => {
            if (!isNavigationCancelled) {
                isNavigationCancelled = true;
                showNotification('Navigation Cancelled', '🍄');
            }
        });
    };

    const findCampaignLinks = () => {
        return Array.from(document.querySelectorAll('img'))
            .filter((img) =>
                CONFIG.CAMPAIGN_KEYWORDS.some((keyword) =>
                    img.alt.includes(keyword)
                )
            )
            .map((img) => img.closest('a'))
            .filter((link) => link && !openedLinks.has(link.href));
    };

    const handleCampaignLinks = (links) => {
        CONFIG.ADDITIONAL_URLS.forEach((url) => {
            if (!openedLinks.has(url)) {
                window.open(
                    url,
                    '_blank',
                    'width=580,height=1200,noopener,noreferrer'
                );
            }
        });

        if (links.length === 1) {
            setTimeout(() => {
                if (!isNavigationCancelled) {
                    openedLinks.add(links[0].href);
                    window.location.href = links[0].href;
                }
            }, CONFIG.LINK_OPEN_DELAY_MS);
        } else {
            links.forEach((link) => {
                openedLinks.add(link.href);
                window.open(
                    link.href,
                    '_blank',
                    'width=580,height=1200,noopener,noreferrer'
                );
            });
        }
    };

    const observeDOMChanges = () => {
        observeDOM(() => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                handleCampaignLinks(findCampaignLinks());
            }, 300);
        });
    };

    const initializeCampaignLinkHelper = () => {
        addClickCancelListener();
        observeDOMChanges();
        console.log('🚀 ニコニコキャンペーンリンクヘルパーが初期化されました');
    };

    // 自動初期化
    initializeCampaignLinkHelper();
})();
