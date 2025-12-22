(function() {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        DeferredMutationObserver
    } = unsafeWindow.MastodonCommon;

    const CONFIG = {
        MUTED_USERS: [
            '@maidrobo',
            '@mistraldroid',
            '@mesugakiroid',
            '@deepseekroid',
            '@glmdroid'
        ],
        TARGET_COLUMN_LABEL: '通知',
        OBSERVE_INTERVAL: 1000
    };

    const isFilterAllActive = () => {
        const filterBar = document.querySelector('div[aria-label="通知"]').querySelector('div.notification__filter-bar');
        if (!filterBar) return true; // フィルターバーがない場合はデフォルトで有効

        const firstButton = filterBar.querySelector('button');
        return firstButton && firstButton.classList.contains('active');
    };

    const removeUserPosts = (column) => {
        // 「すべて」フィルターがアクティブでない場合は処理しない
        if (!isFilterAllActive()) {
            return;
        }

        column.querySelectorAll('article').forEach(article => {
            try {
                const displayNameLinks = article.querySelectorAll('a.status__display-name > span > span');
                const userNames = Array.from(displayNameLinks).map(span => span.textContent.trim());

                const shouldRemove = userNames.some(userName =>
                    CONFIG.MUTED_USERS.includes(userName)
                );

                if (shouldRemove) {
                    article.style.display = 'none';
                }
            } catch (error) {
                console.error('通知カラムの投稿処理中にエラー:', error);
            }
        });
    };

    const monitorNotificationColumn = () => {
        const observer = new DeferredMutationObserver(() => {
            const notificationColumn = document.querySelector(`div[aria-label="${CONFIG.TARGET_COLUMN_LABEL}"]`);

            if (notificationColumn) {
                removeUserPosts(notificationColumn);
            }
        }, CONFIG.OBSERVE_INTERVAL);

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    };

    const init = () => {
        console.log('🚀 Mastodon Notification Column Filter を初期化');

        const notificationColumn = document.querySelector(`div[aria-label="${CONFIG.TARGET_COLUMN_LABEL}"]`);
        if (notificationColumn) {
            removeUserPosts(notificationColumn);
        }

        monitorNotificationColumn();
    };

    init();
})();
