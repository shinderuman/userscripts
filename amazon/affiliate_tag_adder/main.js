(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
    } = unsafeWindow.AmazonCommon;

    const CONFIG = {
        AFFILIATE_PARAMS: {
            tag: 'shinderuman03-22'
        },
        AMAZON_URL_PATTERN: /https?:\/\/(amzn\.asia|www\.amazon\.[a-z.]+)\/[^\s]+/g
    };

    const addAffiliateTag = (url) => {
        try {
            const urlObj = new URL(url);
            urlObj.searchParams.set('tag', CONFIG.AFFILIATE_PARAMS.tag);
            return urlObj.href;
        } catch (error) {
            console.error('URL処理エラー:', error);
            return url;
        }
    };

    const handlePaste = (event) => {
        const clipboardText = event.clipboardData.getData('text');
        const modifiedText = clipboardText.replace(CONFIG.AMAZON_URL_PATTERN, (url) => addAffiliateTag(url));

        if (modifiedText === clipboardText) return;

        event.stopPropagation();
        event.preventDefault();

        const activeElement = document.activeElement;
        if (activeElement && 'value' in activeElement && 'selectionStart' in activeElement) {
            const inputElement = activeElement;
            const { selectionStart: start, selectionEnd: end } = inputElement;
            const newText =
                inputElement.value.substring(0, start || 0) +
                modifiedText +
                inputElement.value.substring(end || 0);

            inputElement.value = newText;
            const newPosition = (start || 0) + modifiedText.length;
            inputElement.setSelectionRange(newPosition, newPosition);

            console.log('🔗 Amazonリンクにアフィリエイトタグを追加しました');
        }
    };

    const initializeAffiliateTagAdder = () => {
        document.addEventListener('paste', handlePaste);
        console.log('🚀 Amazon Affiliate Tag Adder が初期化されました');
        console.log('💡 Amazonリンクをペーストすると自動的にアフィリエイトタグが追加されます');
    };

    // 自動初期化
    initializeAffiliateTagAdder();
})();
