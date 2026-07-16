(function () {
    'use strict';

    // 共通ライブラリから関数を取得
    const { applyStyles } = unsafeWindow.AmazonCommon;

    const CONFIG = {
        // BからはじまるKindleのASINパターン（10文字、前後に英数字がない）
        KINDLE_ASIN_PATTERN: /(?<![A-Z0-9])B[0-9A-Z]{9}(?![A-Z0-9])/g,
        AMAZON_BASE_URL: 'https://www.amazon.co.jp/dp/',
        LINK_STYLES: {
            color: '#0066c0',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontWeight: '500',
            border: '1px solid #ddd',
            padding: '1px 2px',
            borderRadius: '2px'
        }
    };

    const createAsinLink = (asin) => {
        const link = document.createElement('a');
        link.href = CONFIG.AMAZON_BASE_URL + asin;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = asin;
        link.title = `Amazon商品ページを新しいタブで開く: ${asin}`;

        applyStyles(link, CONFIG.LINK_STYLES);

        return link;
    };

    const processTextNode = (textNode) => {
        const text = textNode.textContent;
        const matches = text.match(CONFIG.KINDLE_ASIN_PATTERN);

        if (!matches) return;

        const parent = textNode.parentNode;
        if (!parent) return;

        // 親要素を遡ってリンク内かどうかチェック
        let currentParent = parent;
        while (currentParent) {
            if (currentParent.tagName === 'A') return;
            currentParent = currentParent.parentNode;
        }

        let lastIndex = 0;
        const fragment = document.createDocumentFragment();

        text.replace(CONFIG.KINDLE_ASIN_PATTERN, (match, index) => {
            // マッチ前のテキストを追加
            if (index > lastIndex) {
                fragment.appendChild(
                    document.createTextNode(text.slice(lastIndex, index))
                );
            }

            // ASINリンクを作成して追加
            fragment.appendChild(createAsinLink(match));

            lastIndex = index + match.length;
            return match;
        });

        // 残りのテキストを追加
        if (lastIndex < text.length) {
            fragment.appendChild(
                document.createTextNode(text.slice(lastIndex))
            );
        }

        parent.replaceChild(fragment, textNode);
    };

    const scanForAsins = () => {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // 既にリンク内にあるテキストはスキップ
                    let parent = node.parentNode;
                    while (parent) {
                        if (parent.tagName === 'A') {
                            return NodeFilter.FILTER_REJECT;
                        }
                        parent = parent.parentNode;
                    }
                    // ASINパターンを含むテキストのみ処理
                    return CONFIG.KINDLE_ASIN_PATTERN.test(node.textContent)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );

        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        textNodes.forEach(processTextNode);
    };

    const observeChanges = () => {
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;

            mutations.forEach((mutation) => {
                if (
                    mutation.type === 'childList' &&
                    mutation.addedNodes.length > 0
                ) {
                    shouldScan = true;
                }
            });

            if (shouldScan) {
                // 少し遅延させて処理
                setTimeout(scanForAsins, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    };

    const initializeAsinLinkGenerator = () => {
        // 初回スキャン
        scanForAsins();

        // 動的コンテンツの監視
        observeChanges();

        console.log('🚀 Amazon ASIN Link Generator が初期化されました');
        console.log(
            '💡 BからはじまるKindleのASIN（10文字）を自動的にリンクに変換します'
        );
    };

    // 自動初期化
    initializeAsinLinkGenerator();
})();
