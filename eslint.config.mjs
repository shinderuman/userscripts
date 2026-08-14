import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
    {
        ignores: ['eslint.config.mjs', '**/js/lib/**/*.min.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.node,

                // globalsパッケージに含まれない特殊グローバル
                unsafeWindow: 'readonly',
                GM_setValue: 'readonly',
                GM_getValue: 'readonly',
                GM_deleteValue: 'readonly',
                GM_listValues: 'readonly',
                GM_addStyle: 'readonly',
                GM_getResourceText: 'readonly',
                GM_getResourceURL: 'readonly',
                GM_registerMenuCommand: 'readonly',
                GM_unregisterMenuCommand: 'readonly',
                GM_openInTab: 'readonly',
                GM_xmlhttpRequest: 'readonly',
                GM_download: 'readonly',
                GM_getTab: 'readonly',
                GM_saveTab: 'readonly',
                GM_getTabs: 'readonly',
                GM_notification: 'readonly',
                GM_setClipboard: 'readonly',
                GM_info: 'readonly',
                GM: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn'],
            'no-console': ['off'],
            'no-undef': ['error'],
            'no-redeclare': ['error'],
            'no-duplicate-case': ['error'],
            'no-unreachable': ['error'],

            'prefer-const': ['warn'],
            'no-var': ['warn']
        }
    },
    // Prettier と競合するスタイルルールを無効化（最後に適用）
    prettier
];
