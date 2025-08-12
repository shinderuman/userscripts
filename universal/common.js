// Universal共通ライブラリ
unsafeWindow.UniversalCommon = (function () {
    "use strict";

    // 通知表示ユーティリティ
    const showNotification = (title, text, timeout = 3000, onclick = null) => {
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                title,
                text,
                timeout,
                onclick
            });
        } else {
            console.log(`[${title}] ${text}`);
        }
    };

    // トースト通知表示
    const showToast = (headerText, message, url = null, backgroundColor = '#333', headerBackgroundColor = '#444') => {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.width = '250px';
        toast.style.backgroundColor = backgroundColor;
        toast.style.color = '#fff';
        toast.style.borderRadius = '5px';
        toast.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        toast.style.zIndex = 'calc(infinity)';
        toast.style.cursor = 'pointer';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

        const toastHeader = document.createElement('div');
        toastHeader.textContent = headerText;
        toastHeader.style.backgroundColor = headerBackgroundColor;
        toastHeader.style.padding = '10px';
        toastHeader.style.fontWeight = 'bold';
        toastHeader.style.borderTopLeftRadius = '5px';
        toastHeader.style.borderTopRightRadius = '5px';

        const toastBody = document.createElement('div');
        toastBody.textContent = message;
        toastBody.style.padding = '10px';
        toastBody.style.fontSize = '14px';

        toast.appendChild(toastHeader);
        toast.appendChild(toastBody);

        if (url) {
            toast.onclick = () => {
                window.open(url, '_blank');
                toast.remove();
            };
        }

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 100);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 3000);
    };

    // クリップボード操作
    const copyToClipboard = async (text) => {
        try {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(text);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            } else {
                // フォールバック
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    };

    // 新しいタブで開く
    const openInTab = (url, options = {}) => {
        if (typeof GM_openInTab !== 'undefined') {
            GM_openInTab(url, options);
        } else {
            window.open(url, '_blank');
        }
    };

    // キーイベントのデフォルト動作を防ぐ
    const preventDefaultKeys = (event, keys) => {
        if (keys.includes(event.key)) {
            event.preventDefault();
        }
    };

    // URL操作ユーティリティ
    const cleanUrl = (url, paramsToRemove = ['fbclid']) => {
        try {
            const urlObj = new URL(url);
            paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
            return urlObj.href;
        } catch (error) {
            console.error('URL cleaning error:', error);
            return url;
        }
    };

    // DOM要素の待機
    const waitForElement = (selector, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    };

    // デバウンス関数
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // 公開API
    return {
        showNotification,
        showToast,
        copyToClipboard,
        openInTab,
        preventDefaultKeys,
        cleanUrl,
        waitForElement,
        debounce
    };
})();