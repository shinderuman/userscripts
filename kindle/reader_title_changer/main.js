(function() {
    'use strict';

    const CONFIG = {
        TARGET_ID: 'readerChromeTitle'
    };

    const changeReaderTitle = () => {
        const titleElement = document.getElementById(CONFIG.TARGET_ID);
        if (titleElement) {
            document.title = titleElement.textContent;
        }
    };

    const init = () => {
        console.log('🚀 Kindle Reader Title Changer を初期化');
        changeReaderTitle();
    };

    init();
})();
