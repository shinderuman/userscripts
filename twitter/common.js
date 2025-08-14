// Twitter/X共通ライブラリ
unsafeWindow.TwitterCommon = (function () {
    "use strict";

    // Intent URLパターン
    const INTENT_PATTERNS = [
        'twitter.com/intent/tweet',
        'twitter.com/intent/post',
        'twitter.com/share',
        'x.com/intent/post',
        'x.com/intent/tweet',
        'x.com/share',
        'twitter://intent/tweet',
        'twitter://intent/post',
    ];

    // Intent URLかどうかを判定
    const isIntentUrl = (url) => {
        if (!url) return false;
        
        // 既存のパターンマッチング
        if (INTENT_PATTERNS.some(pattern => url.includes(pattern))) {
            return true;
        }
        
        // 正規表現による柔軟なマッチング
        const intentRegex = /(twitter|x)\.com\/(intent\/(tweet|post)|share)|twitter:\/\/intent\/(tweet|post)/i;
        return intentRegex.test(url);
    };

    // Intent URLからパラメータを抽出
    const extractIntentParams = (url) => {
        const urlParams = new URL(url).searchParams;
        return {
            text: urlParams.get('text') || '',
            url: urlParams.get('url') || '',
            hashtags: urlParams.get('hashtags')?.split(',').map(tag => `#${tag}`).join('\n') || ''
        };
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

    // クリップボードにコピー
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            return false;
        }
    };

    // 現在のユーザー名を取得
    const getCurrentUser = () => {
        return Array.from(document.querySelectorAll('div[aria-label="ホームタイムライン"] span'))
            .find(el => el.textContent.trim().startsWith('@'))?.textContent.trim();
    };

    // ボタン作成
    const createButton = (text, styles = {}) => {
        const button = document.createElement('button');
        button.innerText = text;
        
        const defaultStyles = {
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: '9999',
            padding: '10px',
            backgroundColor: '#1da1f2',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
        };

        Object.assign(button.style, defaultStyles, styles);
        return button;
    };

    // 公開API
    return {
        INTENT_PATTERNS,
        isIntentUrl,
        extractIntentParams,
        showToast,
        copyToClipboard,
        getCurrentUser,
        createButton
    };
})();