// Twitter/X共通ライブラリ
unsafeWindow.TwitterCommon = (function () {
    'use strict';

    // 現在のユーザー名を取得
    const getCurrentUser = () => {
        return Array.from(
            document.querySelectorAll(
                'div[aria-label="ホームタイムライン"] span'
            )
        )
            .find((el) => el.textContent.trim().startsWith('@'))
            ?.textContent.trim();
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
        getCurrentUser,
        createButton
    };
})();
