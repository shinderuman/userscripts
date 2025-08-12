(function() {
    'use strict';

    const CONFIG = {
        BLUR_FILTER: 'blur(8px)',
        MODIFIER_KEY: 'altKey' // Option/Alt key
    };

    const toggleBlur = (element) => {
        element.style.filter = element.style.filter ? '' : CONFIG.BLUR_FILTER;
    };

    const handleClick = (event) => {
        if (event[CONFIG.MODIFIER_KEY]) {
            const target = event.target;
            toggleBlur(target);

            event.stopPropagation();
            event.preventDefault();
        }
    };

    const initializeBlurOnClick = () => {
        document.addEventListener('click', handleClick, true);
        console.log("🚀 Blur on Click が初期化されました");
        console.log("💡 Option+Clickで要素にモザイクをかけることができます");
    };

    // グローバル関数として公開
    unsafeWindow.initializeBlurOnClick = initializeBlurOnClick;

    console.log("🚀 Blur on Click が読み込まれました");
    console.log("💡 自動的に初期化されます");

    // 自動初期化
    initializeBlurOnClick();
})();