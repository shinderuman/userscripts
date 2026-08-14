unsafeWindow.TwitterCommon = (function () {
    'use strict';

    const getCurrentUser = () => {
        return Array.from(
            document.querySelectorAll(
                'div[aria-label="ホームタイムライン"] span'
            )
        )
            .find((el) => el.textContent.trim().startsWith('@'))
            ?.textContent.trim();
    };

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

    return {
        getCurrentUser,
        createButton
    };
})();
