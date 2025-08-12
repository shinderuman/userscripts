(function() {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        getCurrentUser,
        createButton
    } = unsafeWindow.TwitterCommon;

    let isFiltered = false;

    const showOnlyCurrentUserTweets = () => {
        const currentUser = getCurrentUser();
        if (!currentUser) return;

        Array.from(document.querySelectorAll('article'))
            .filter(tweet => tweet.querySelector('div[data-testid="User-Name"] div div div a div span')?.textContent.trim() !== currentUser)
            .forEach(tweet => {
                tweet.style.display = 'none';
            });
    };

    const showAllTweets = () => {
        Array.from(document.querySelectorAll('article')).forEach(tweet => {
            tweet.style.display = '';
        });
    };

    const toggleTweets = () => isFiltered ? showOnlyCurrentUserTweets() : showAllTweets();

    const createToggleButton = () => {
        const button = createButton('このアカウントのみ表示');
        document.body.appendChild(button);

        button.addEventListener('click', () => {
            isFiltered = !isFiltered;
            toggleTweets();
            button.innerText = isFiltered ? 'すべて表示' : 'このアカウントのみ表示';
        });

        return button;
    };

    const initializeShowYourself = () => {
        const observer = new MutationObserver(toggleTweets);
        observer.observe(document.body, { childList: true, subtree: true });

        createToggleButton();
        console.log("🚀 Twitter Show Yourself が初期化されました");
    };

    // グローバル関数として公開
    unsafeWindow.initializeShowYourself = initializeShowYourself;

    console.log("🚀 Twitter Show Yourself が読み込まれました");
    console.log("💡 自動的に初期化されます");

    // 自動初期化
    initializeShowYourself();
})();