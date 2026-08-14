(function () {
    'use strict';

    const SELECTORS = {
        WISHLIST_LINKS: '#file-md-readme > article > ul > li > a'
    };

    const createButton = (label, onClick, styles = {}) => {
        const button = document.createElement('button');
        button.textContent = label;

        const defaultStyles = {
            padding: '10px 20px',
            backgroundColor: '#0366d6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            fontSize: '14px',
            fontWeight: '500'
        };

        Object.assign(button.style, defaultStyles, styles);

        button.addEventListener('click', onClick);
        return button;
    };

    const createContainer = (styles = {}) => {
        const container = document.createElement('div');

        const defaultStyles = {
            position: 'fixed',
            top: '50%',
            right: '10px',
            transform: 'translateY(-50%)',
            zIndex: '1000',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e1e4e8'
        };

        Object.assign(container.style, defaultStyles, styles);

        return container;
    };

    const parseDate = (text) => {
        const match = text.match(/^\[(\d{4})-(\d{2})-(\d{2})\]/);
        if (!match) return null;

        const [, year, month, day] = match;
        const date = new Date(`${year}-${month}-${day}`);
        date.setHours(0, 0, 0, 0);
        return date;
    };

    const getTodayStart = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    };

    unsafeWindow.GitHubCommon = {
        SELECTORS,
        createButton,
        createContainer,
        parseDate,
        getTodayStart
    };
})();
