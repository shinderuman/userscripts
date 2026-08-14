(function () {
    'use strict';

    const { observeDOM, setGridColumns, removePastStreams } =
        unsafeWindow.YouTubeCommon;

    const CONFIG = {
        COLUMN_COUNT: 5
    };

    const applyModifications = () => {
        removePastStreams();
        setGridColumns(CONFIG.COLUMN_COUNT);
    };

    const initializeSubscriptionModifier = () => {
        applyModifications();

        observeDOM(applyModifications);

        console.log('🚀 YouTube Subscription Modifier が初期化されました');
        console.log(
            `💡 ${CONFIG.COLUMN_COUNT}列表示に設定し、配信済み動画を非表示にします`
        );
    };

    initializeSubscriptionModifier();
})();
