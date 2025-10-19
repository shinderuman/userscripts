(function () {
    'use strict';

    // AWS共通設定
    const AWS_COMMON_CONFIG = {
        // 将来的な共通設定用
    };

    // AWS共通ライブラリ
    const AWSCommon = {
        // 共通設定
        CONFIG: AWS_COMMON_CONFIG
    };

    // グローバルに公開
    unsafeWindow.AWSCommon = AWSCommon;
})();