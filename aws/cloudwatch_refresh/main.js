(function () {
    'use strict';

    // ダッシュボード画面でのみ動作するようにURL制限
    if (!window.location.hash.includes('#dashboards/dashboard/')) {
        return;
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'r') {
            const refreshButton = document.querySelector('button[data-analytics="Refresh-btn"]');
            if (refreshButton) {
                refreshButton.click();
            }
        }
    });

    console.log('🚀 CloudWatch Refresh が初期化されました');
})();