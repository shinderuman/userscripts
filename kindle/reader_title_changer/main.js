(function() {
    'use strict';

    const CONFIG = {
        TARGET_ID: 'readerChromeTitle',
        MAX_ATTEMPTS: 10,
        RETRY_INTERVAL_MS: 1000
    };

    const changeReaderTitle = () => {
        const titleElement = document.getElementById(CONFIG.TARGET_ID);
        if (titleElement) {
            document.title = titleElement.textContent;
        }
    };

    const init = () => {
        console.log('🚀 Kindle Reader Title Changer を初期化');

        let count = 0;

        const tryChangeTitle = () => {
            changeReaderTitle();
            if (document.title === 'Kindle' && count < CONFIG.MAX_ATTEMPTS) {
                count++;
                setTimeout(tryChangeTitle, CONFIG.RETRY_INTERVAL_MS);
            }
        };

        tryChangeTitle();
    };

    init();
})();
