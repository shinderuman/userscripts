unsafeWindow.UniversalCommon = (function () {
    'use strict';

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

    const showToast = (
        headerText,
        message,
        url = null,
        backgroundColor = '#333',
        headerBackgroundColor = '#444'
    ) => {
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

    const copyToClipboard = async (text) => {
        try {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(text);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            } else {
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

    const openInTab = (url, options = {}) => {
        if (typeof GM_openInTab !== 'undefined') {
            GM_openInTab(url, options);
        } else {
            window.open(url, '_blank');
        }
    };

    const preventDefaultKeys = (event, keys) => {
        if (keys.includes(event.key)) {
            event.preventDefault();
        }
    };

    const cleanUrl = (url, paramsToRemove = ['fbclid']) => {
        try {
            const urlObj = new URL(url);
            paramsToRemove.forEach((param) =>
                urlObj.searchParams.delete(param)
            );
            return urlObj.href;
        } catch (error) {
            console.error('URL cleaning error:', error);
            return url;
        }
    };

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
                reject(
                    new Error(
                        `Element ${selector} not found within ${timeout}ms`
                    )
                );
            }, timeout);
        });
    };

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

    const normalizeDigits = (s) =>
        s.replace(/[０-９]/g, (d) =>
            String.fromCharCode(d.charCodeAt(0) - 0xfee0)
        );

    // タイトルから検索用の作品名（メインタイトル）を取得。
    // 方針: サブタイトル（最初の〜/～以降）を切り捨て、末尾の「N巻」「第N巻」「巻数括弧(N)」「雑誌名括弧」「単独数字」を再帰除去。
    // 先頭の数字（「100万」等）は保持。
    const parseBaseTitle = (title) => {
        const main = normalizeDigits(title).split(/[〜～]/)[0];
        const s = main.replace(/\s+$/, '');

        const volSuffix = s.match(/[\s　]?第?[0-9]+巻$/);
        if (volSuffix) {
            return parseBaseTitle(s.slice(0, s.length - volSuffix[0].length));
        }
        const trailingParen = s.match(/[（(][^（(0-9]*[）)]$/);
        if (trailingParen) {
            return parseBaseTitle(
                s.slice(0, s.length - trailingParen[0].length)
            );
        }
        const trailingNumParen = s.match(/[（(][0-9]+[）)]$/);
        if (trailingNumParen) {
            return parseBaseTitle(
                s.slice(0, s.length - trailingNumParen[0].length)
            );
        }
        const stripped = s.replace(/[\s　]?[0-9]+$/, '');
        if (stripped !== s) {
            return parseBaseTitle(stripped);
        }
        return s.replace(/\s+$/, '');
    };

    return {
        showNotification,
        showToast,
        copyToClipboard,
        openInTab,
        preventDefaultKeys,
        cleanUrl,
        waitForElement,
        debounce,
        normalizeDigits,
        parseBaseTitle
    };
})();
