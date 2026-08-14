(function () {
    'use strict';

    if (!window.location.hash.includes('#dashboards/dashboard/')) {
        return;
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'r' && !event.metaKey) {
            const refreshButton = document.querySelector(
                'button[data-analytics="Refresh-btn"]'
            );
            if (refreshButton) {
                refreshButton.click();
            }
        }
    });

    console.log('🚀 CloudWatch Refresh が初期化されました');
})();
