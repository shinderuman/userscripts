(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const {
        observeDOM,
        setGridColumns,
        removePastStreams
    } = unsafeWindow.YouTubeCommon;

    const CONFIG = {
        COLUMN_COUNT: 5 // 表示する列数
    };

    const applyModifications = () => {
        removePastStreams();
        setGridColumns(CONFIG.COLUMN_COUNT);
    };

    const initializeSubscriptionModifier = () => {
        // 初期実行
        applyModifications();

        // DOM変化を監視し、両方の処理を適用
        observeDOM(applyModifications);

        console.log('🚀 YouTube Subscription Modifier が初期化されました');
        console.log(`💡 ${CONFIG.COLUMN_COUNT}列表示に設定し、配信済み動画を非表示にします`);
    };

    // 自動初期化
    initializeSubscriptionModifier();
})();