const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { DOMParser: HTMLParser, parseHTML } = require('linkedom');
const { IDBFactory: TestIDBFactory } = require('fake-indexeddb');

const productHTML = fs.readFileSync(
    path.join(__dirname, 'fixtures/product.html'),
    'utf8'
);
const searchHTML = fs.readFileSync(
    path.join(__dirname, 'fixtures/search.html'),
    'utf8'
);
const subscriptionHTML = fs.readFileSync(
    path.join(__dirname, 'fixtures/subscription.html'),
    'utf8'
);
const productURL = 'https://www.amazon.co.jp/dp/B0CTC5XTDM';
const paperResponseHTML = fs.readFileSync(
    path.join(__dirname, 'fixtures/paper-response.html'),
    'utf8'
);
const productResponseHTML = fs.readFileSync(
    path.join(__dirname, 'fixtures/product-response.html'),
    'utf8'
);
const paperFormatsResponseHTML = fs.readFileSync(
    path.join(__dirname, 'fixtures/paper-formats-response.html'),
    'utf8'
);
const paperOnlyResponseHTML = fs.readFileSync(
    path.join(__dirname, 'fixtures/paper-only-response.html'),
    'utf8'
);

function setup(html = productHTML, indexedDB = new TestIDBFactory()) {
    const { document } = parseHTML(
        `<html><head></head><body><div id="nav-belt"></div><div id="nav-logo"></div>${html}</body></html>`
    );
    const stored = new Map();
    const notifications = [];
    const tabs = [];
    const requests = [];
    const logs = [];
    const responses = new Map();
    responses.set(
        'https://www.amazon.co.jp/dp/4088931939',
        paperResponseHTML.replace('979', '715')
    );
    responses.set('https://www.amazon.co.jp/dp/4040766342', paperResponseHTML);
    responses.set(
        'https://www.amazon.co.jp/dp/B0HD9ZM46H',
        '<div id="corePriceDisplay_desktop_feature_div"></div>'
    );
    const sandbox = {
        document,
        window: { location: { href: productURL } },
        unsafeWindow: {},
        DOMParser: HTMLParser,
        indexedDB,
        MutationObserver: document.defaultView.MutationObserver,
        setTimeout,
        clearTimeout,
        URL,
        console: {
            log: (...args) => logs.push(args.join(' ')),
            warn() {},
            error() {}
        },
        localStorage: {
            getItem: (key) => stored.get(key) ?? null,
            setItem: (key, value) => stored.set(key, value),
            removeItem: (key) => stored.delete(key)
        },
        GM_notification: (notification) => notifications.push(notification),
        GM_openInTab: (url) => tabs.push(url),
        GM_xmlhttpRequest: (request) => {
            requests.push(request.url);
            const response = responses.get(request.url.split('?')[0]);
            assert.ok(
                response !== undefined,
                `Unexpected request: ${request.url}`
            );
            if (typeof response === 'function') {
                response(request);
                return;
            }
            request.onload({
                status: 200,
                responseText:
                    typeof response === 'string'
                        ? response
                        : JSON.stringify(response)
            });
        },
        Image: class {
            set src(value) {
                this.url = value;
            }
        }
    };
    const createElement = document.createElement.bind(document);
    document.createElement = (tag) => {
        const element = createElement(tag);
        if (tag === 'canvas') element.getContext = () => ({});
        return element;
    };
    const context = vm.createContext(sandbox);
    const load = (file) =>
        vm.runInContext(
            fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
            context
        );
    load('common.js');
    return {
        ...sandbox,
        load,
        responses,
        notifications,
        tabs,
        requests,
        logs,
        stored,
        common: sandbox.unsafeWindow.KindleCommon
    };
}

function setupConcurrentNewReleases(authorCount, booksPerAuthor, limit) {
    const env = setup();
    env.common.COMMON_CONFIG.CONCURRENT_REQUESTS = limit;
    env.common.COMMON_CONFIG.NEW_RELEASE_DAYS = 100000;
    const authors = Array.from({ length: authorCount }, (_, index) => ({
        Name: `著者${index}`
    }));
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, authors);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);

    const pending = [];
    const expectedURLs = [];
    let active = 0;
    let peak = 0;
    const holdResponse = (request, html) => {
        active++;
        peak = Math.max(peak, active);
        const entry = {
            url: request.url,
            finish(error = null) {
                pending.splice(pending.indexOf(entry), 1);
                active--;
                if (error) request.onerror(error);
                else request.onload({ status: 200, responseText: html });
            }
        };
        pending.push(entry);
    };

    env.responses.set('https://www.amazon.co.jp/s', (request) => {
        const name = new URL(request.url).searchParams.get('k');
        const authorIndex = authors.findIndex((author) => author.Name === name);
        const cards = Array.from({ length: booksPerAuthor }, (_, index) => {
            const asin = `B0TEST${String(authorIndex * booksPerAuthor + index).padStart(4, '0')}`;
            const url = `https://www.amazon.co.jp/ebook/dp/${asin}/ref=sr_1_2`;
            expectedURLs.push(url);
            env.responses.set(url, (productRequest) =>
                holdResponse(productRequest, productHTML)
            );
            return searchHTML
                .replaceAll('B0HHBSR4QZ', asin)
                .replaceAll('高瀬わか', name);
        }).join('');
        holdResponse(request, cards);
    });
    env.load('new_release_checker/main.js');
    return {
        env,
        pending,
        expectedURLs,
        get active() {
            return active;
        },
        get peak() {
            return peak;
        }
    };
}

const flushRequests = () => new Promise(setImmediate);
const waitFor = async (condition) => {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (condition()) return;
        await flushRequests();
    }
    assert.fail('非同期処理が期待した状態に到達しませんでした');
};

test(
    '新刊の商品取得を並列に開始し、著者をまたぐ検索・商品取得の合計を20件以内に保つ',
    { timeout: 2000 },
    async () => {
        const scenario = setupConcurrentNewReleases(3, 10, 20);
        const { env, pending, expectedURLs } = scenario;
        const checking = env.unsafeWindow.checkNewReleases();
        await waitFor(() => pending.length === 3);
        assert.equal(pending.length, 3);

        pending[0].finish();
        await flushRequests();
        assert.equal(
            pending.filter((entry) => entry.url.includes('/ebook/dp/')).length,
            10,
            '最初の商品の応答を待たず10冊とも開始する'
        );

        pending
            .filter((entry) => new URL(entry.url).pathname === '/s')
            .forEach((entry) => entry.finish());
        await flushRequests();
        assert.equal(scenario.active, 20);
        while (pending.length > 0) {
            pending.at(-1).finish();
            await flushRequests();
        }
        await checking;
        assert.equal(scenario.peak, 20);
        assert.equal(scenario.active, 0);
        assert.equal(env.tabs.length, 30);
        for (let index = 0; index < 3; index++) {
            const authorURLs = expectedURLs.slice(index * 10, (index + 1) * 10);
            assert.deepEqual(
                env.tabs.filter((url) => authorURLs.includes(url)),
                authorURLs,
                '応答が逆順でも著者内の検索順を維持する'
            );
        }
    }
);

test(
    '検索が同時実行上限を埋めても商品取得に移行し、失敗した枠を解放して残りを処理する',
    { timeout: 2000 },
    async () => {
        const scenario = setupConcurrentNewReleases(2, 2, 2);
        const { env, pending, expectedURLs } = scenario;
        const checking = env.unsafeWindow.checkNewReleases();
        await waitFor(() => pending.length === 2);
        assert.equal(pending.length, 2);
        [...pending].forEach((entry) => entry.finish());
        await flushRequests();
        assert.equal(pending.length, 2, '検索の枠を解放して商品取得を開始する');
        assert.ok(pending.every((entry) => entry.url.includes('/ebook/dp/')));

        const failedURL = pending[0].url.split('?')[0];
        pending[0].finish(new Error('通信失敗'));
        await flushRequests();
        assert.equal(pending.length, 2, '失敗した枠で次の商品の取得を開始する');
        while (pending.length > 0) {
            pending.at(-1).finish();
            await flushRequests();
        }
        await checking;
        assert.equal(scenario.peak, 2);
        assert.equal(scenario.active, 0);
        assert.deepEqual(
            [...env.tabs].sort(),
            expectedURLs.filter((url) => url !== failedURL).sort()
        );
    }
);

test(
    '新刊検索は20件を同時に開始し、1人が完了したら残り19人を待たず21人目を開始する',
    { timeout: 2000 },
    async () => {
        const scenario = setupConcurrentNewReleases(21, 1, 20);
        const { env, pending } = scenario;
        const checking = env.unsafeWindow.checkNewReleases();
        await waitFor(() => pending.length === 20);
        assert.equal(pending.length, 20);
        assert.ok(
            pending.every((entry) => new URL(entry.url).pathname === '/s')
        );
        const unfinishedSearches = pending.slice(1);
        pending[0].finish();
        await flushRequests();
        const product = pending.find((entry) =>
            entry.url.includes('/ebook/dp/')
        );
        assert.ok(product);
        product.finish();
        await waitFor(() =>
            pending.some(
                (entry) => new URL(entry.url).searchParams.get('k') === '著者20'
            )
        );
        assert.ok(
            pending.some(
                (entry) => new URL(entry.url).searchParams.get('k') === '著者20'
            ),
            '20件全完了を待たず21人目の検索を開始する'
        );
        assert.ok(
            unfinishedSearches.every((entry) => pending.includes(entry)),
            '他の19人の応答は未完了のまま'
        );
        assert.equal(scenario.active, 20);
        while (pending.length > 0) {
            pending.at(-1).finish();
            await flushRequests();
        }
        await checking;
        assert.equal(scenario.peak, 20);
        assert.equal(scenario.active, 0);
        assert.equal(env.tabs.length, 21);
    }
);

test('販売価格と獲得ポイントを読み、期間限定無料の期限を価格に混ぜない', async () => {
    const { common, document } = setup();
    const info = await common.fetchAmazonProductInfo(document);
    assert.equal(info.kindlePrice, 715);
    assert.equal(info.paperPrice, 715);
    assert.equal(info.points, 358);
    assert.match(common.evaluateSaleConditions(info), /50\.07%/);
});

test('Kindle・紙の形式判定と、選択できない紙書籍の除外', () => {
    const { common, document } = setup();
    assert.equal(common.getBookAvailability(document).paperBookAvailable, true);
    assert.equal(
        common.getBookAvailability(document).kindleBookAvailable,
        true
    );
    document
        .querySelector('[data-asin="4088931939"]')
        .setAttribute('data-initiallyunavailable', 'true');
    assert.equal(
        common.getBookAvailability(document).paperBookAvailable,
        false
    );
});

test('紙ページの実応答にあるnonJSFormatsで紙版・Kindle版を両方検出する', () => {
    const { common, document } = setup(paperFormatsResponseHTML);
    assert.equal(common.getBookAvailability(document).paperBookAvailable, true);
    assert.equal(
        common.getBookAvailability(document).kindleBookAvailable,
        true
    );
});

test('紙のみの実応答では単行本を紙版として検出し、Kindle版を検出しない', () => {
    const { common, document } = setup(paperOnlyResponseHTML);
    assert.equal(common.getBookAvailability(document).paperBookAvailable, true);
    assert.equal(
        common.getBookAvailability(document).kindleBookAvailable,
        false
    );
});

test('新しい画面の単一形式でも紙版を検出し、Kindle版ありと誤判定しない', () => {
    const html = fs.readFileSync(
        path.join(__dirname, 'fixtures/paper-singleton.html'),
        'utf8'
    );
    const { common, document } = setup(html);
    assert.equal(common.getBookAvailability(document).paperBookAvailable, true);
    assert.equal(
        common.getBookAvailability(document).kindleBookAvailable,
        false
    );
});

test('nonJSFormatsの選択中の紙ASINで価格を取得する', async () => {
    const env = setup(paperFormatsResponseHTML);
    const info = await env.common.fetchAmazonProductInfo(env.document);
    assert.equal(info.paperPrice, 715);
    assert.deepEqual(env.requests, ['https://www.amazon.co.jp/dp/4088931939']);
});

test('nonJSFormatsの未選択の紙版はリンク先のASINで価格を取得する', async () => {
    const env = setup(paperFormatsResponseHTML);
    const paperLink = env.document.querySelector(
        '#tmm-grid-swatch-OTHER a.a-button-text'
    );
    paperLink.setAttribute('aria-checked', 'false');
    paperLink.setAttribute('href', '/dp/4088931939/ref=tmm_pap_swatch_0');
    env.document.querySelector('#ASIN').remove();
    const info = await env.common.fetchAmazonProductInfo(env.document);
    assert.equal(info.paperPrice, 715);
    assert.deepEqual(env.requests, ['https://www.amazon.co.jp/dp/4088931939']);
});

test('読み放題の0円やポイント利用後の請求額ではなく購入価格889円を読む', async () => {
    const { common, document } = setup(subscriptionHTML);
    const info = await common.fetchAmazonProductInfo(document);
    assert.equal(info.kindlePrice, 889);
    assert.equal(info.points, 9);
    assert.equal(
        info.paperPrice,
        0,
        '中古などのオプション価格を紙の定価として扱わない'
    );
    assert.equal(common.getBookAvailability(document).paperBookAvailable, true);
    assert.equal(common.evaluateSaleConditions(info), null);
});

test('実レスポンスで空の形式スロットから価格を読まず、紙ページの購入価格を取得する', async () => {
    const env = setup(productResponseHTML);
    const info = await env.common.fetchAmazonProductInfo(env.document);
    assert.equal(info.kindlePrice, 979);
    assert.equal(info.paperPrice, 979);
    assert.deepEqual(env.requests, ['https://www.amazon.co.jp/dp/4040766342']);
});

test('Sale Checkerは取得した358ポイントでセール通知を出す', async () => {
    const env = setup();
    env.responses.set(env.common.COMMON_CONFIG.UNPROCESSED_BOOKS_URL, [
        { URL: productURL, Title: '登録タイトル' }
    ]);
    env.responses.set(productURL, productHTML);
    env.load('sale_checker/main.js');
    await env.unsafeWindow.checkWishlistSales();
    assert.match(env.notifications[0].title, /1件のセール/);
    env.notifications[0].onclick();
    assert.deepEqual(env.tabs, [productURL]);
});

test('Paper to Kindle Checkerは紙ページの両形式を検出する', async () => {
    const env = setup();
    const paperURL = 'https://www.amazon.co.jp/dp/4088931939';
    env.responses.set(env.common.COMMON_CONFIG.PAPER_BOOKS_URL, [
        { ASIN: '4088931939', Title: '登録タイトル' }
    ]);
    env.responses.set(paperURL, paperFormatsResponseHTML);
    env.load('paper_to_kindle_checker/main.js');
    await env.unsafeWindow.checkPaperToKindle();
    assert.deepEqual(env.tabs, [paperURL]);
    assert.equal(
        env.requests.length,
        2,
        'S3と商品ページの2リクエストだけで判定する'
    );
});

test('Paper to Kindle CheckerはKindle版のない紙書籍を開かない', async () => {
    const env = setup();
    const paperURL = 'https://www.amazon.co.jp/dp/4824017513';
    env.responses.set(env.common.COMMON_CONFIG.PAPER_BOOKS_URL, [
        { ASIN: '4824017513', Title: '貞操逆転世界の童貞辺境領主騎士 4' }
    ]);
    env.responses.set(paperURL, paperOnlyResponseHTML);
    env.load('paper_to_kindle_checker/main.js');
    await env.unsafeWindow.checkPaperToKindle();
    assert.deepEqual(env.tabs, []);
    assert.equal(env.requests.length, 2);
});

test('Paper to Kindle Checkerは4049723255の両表示形式で紙あり・Kindleなしと表示する', async () => {
    for (const name of [
        'paper-media-matrix.html',
        'paper-4049723255-response.html'
    ]) {
        const env = setup();
        env.responses.set(env.common.COMMON_CONFIG.PAPER_BOOKS_URL, [
            { ASIN: '4049723255', Title: '俺に都合が良すぎる街 2' }
        ]);
        env.responses.set(
            'https://www.amazon.co.jp/dp/4049723255',
            fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
        );
        env.load('paper_to_kindle_checker/main.js');
        await env.unsafeWindow.checkPaperToKindle();
        assert.ok(
            env.logs.some((line) => line.includes('紙書籍: ✅, Kindle: ❌')),
            name
        );
        assert.deepEqual(env.tabs, []);
        assert.equal(env.requests.length, 2);
    }
});

test('Sale・Paper Checkerの取得失敗時は共通通知から従来のエラー文言を出す', async () => {
    for (const [script, entry, key, text] of [
        [
            'sale_checker',
            'checkWishlistSales',
            'UNPROCESSED_BOOKS_URL',
            'セールチェック中にエラーが発生しました'
        ],
        [
            'paper_to_kindle_checker',
            'checkPaperToKindle',
            'PAPER_BOOKS_URL',
            '利用可能性チェック中にエラーが発生しました'
        ]
    ]) {
        const env = setup();
        env.responses.set(env.common.COMMON_CONFIG[key], (request) =>
            request.onload({ status: 503, responseText: '' })
        );
        env.load(`${script}/main.js`);
        await env.unsafeWindow[entry]();
        assert.equal(env.notifications.length, 1);
        assert.equal(env.notifications[0].title, '❌ エラー');
        assert.equal(env.notifications[0].text, text);
        assert.equal(env.notifications[0].timeout, 5000);
        assert.deepEqual(env.tabs, []);
    }
});

test('New Release Checkerは検索結果の著者を検出し、商品詳細の発売日で判定する', async () => {
    const env = setup();
    env.common.COMMON_CONFIG.NEW_RELEASE_DAYS = 100000;
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
        { Name: '高瀬わか' }
    ]);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
    env.responses.set('https://www.amazon.co.jp/s', searchHTML);
    env.responses.set(
        'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2',
        productHTML
    );
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    assert.deepEqual(env.tabs, [
        'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2'
    ]);
    assert.equal(env.requests.length, 4);
    assert.equal(
        JSON.parse(env.stored.get('newReleaseNotifications'))[0].price,
        null
    );
    await env.unsafeWindow.checkNewReleases();
    assert.equal(env.tabs.length, 1, '通知済みの商品は再度開かない');
});

test('New Release Checkerは検索情報で判定できる新刊・旧刊・低価格・無料の商品を取得しない', async () => {
    const env = setup();
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
        { Name: '石田 彩' }
    ]);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
    env.responses.set(
        'https://www.amazon.co.jp/s',
        fs.readFileSync(
            path.join(__dirname, 'fixtures/search-metadata.html'),
            'utf8'
        )
    );
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    assert.equal(
        env.requests.length,
        3,
        '作者リスト・除外語・検索の3リクエストだけを行う'
    );
    assert.deepEqual(env.tabs, ['https://www.amazon.co.jp/dp/B0HP8Q5WSS']);
    const [book] = JSON.parse(env.stored.get('newReleaseNotifications'));
    assert.equal(book.price, 979);
    assert.equal(new Date(book.releaseDate).getFullYear(), 2026);
});

test('New Release Checkerは発売日不足だけを補い、価格不明は従来どおり許容する', async () => {
    for (const missing of ['date', 'price']) {
        const env = setup();
        const { document } = parseHTML(
            fs.readFileSync(
                path.join(__dirname, 'fixtures/search-metadata.html'),
                'utf8'
            )
        );
        const first = document.querySelector('[data-asin="B0HP8Q5WSS"]');
        if (missing === 'date')
            first
                .querySelector('.a-size-base.a-color-secondary.a-text-normal')
                .remove();
        else
            first
                .querySelector('[data-csa-c-price-to-pay]')
                .removeAttribute('data-csa-c-price-to-pay');
        env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
            { Name: '石田 彩' }
        ]);
        env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
        env.responses.set('https://www.amazon.co.jp/s', document.toString());
        const detailURL = 'https://www.amazon.co.jp/dp/B0HP8Q5WSS';
        env.responses.set(detailURL, productResponseHTML);
        env.load('new_release_checker/main.js');
        await env.unsafeWindow.checkNewReleases();
        assert.equal(env.requests.length, missing === 'date' ? 4 : 3, missing);
        assert.equal(
            env.requests.filter((url) => url === detailURL).length,
            missing === 'date' ? 1 : 0,
            missing
        );
        assert.deepEqual(env.tabs, [detailURL], missing);
        assert.equal(
            JSON.parse(env.stored.get('newReleaseNotifications'))[0].price,
            missing === 'date' ? 979 : null
        );
    }
});

test('New Release Checkerは検索欄が0円でも購入価格で判定する', async () => {
    const env = setup();
    env.common.COMMON_CONFIG.NEW_RELEASE_DAYS = 100000;
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
        { Name: '高瀬わか' }
    ]);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
    env.responses.set(
        'https://www.amazon.co.jp/s',
        searchHTML.replace('￥770', '￥0')
    );
    env.responses.set(
        'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2',
        productHTML
    );
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    assert.equal(env.tabs.length, 1);
});

test('New Release Checkerは対象外の著者を商品詳細の取得前に除外する', async () => {
    const env = setup();
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
        { Name: '別の著者' }
    ]);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
    env.responses.set('https://www.amazon.co.jp/s', searchHTML);
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    assert.deepEqual(env.tabs, []);
    assert.equal(env.requests.length, 3);
});

test('New Release Checkerは無料キャンペーンの期限を発売日にしない', async () => {
    const env = setup();
    env.common.COMMON_CONFIG.NEW_RELEASE_DAYS = 0;
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
        { Name: '高瀬わか' }
    ]);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
    env.responses.set('https://www.amazon.co.jp/s', searchHTML);
    env.responses.set(
        'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2',
        productHTML
    );
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    assert.deepEqual(env.tabs, []);
});

test('HighlighterはKindleページの表示情報だけで判定し、商品リクエストを出さない', async () => {
    for (const missing of [
        null,
        '#productTitle',
        '#inline-twister-expander-content-media_format'
    ]) {
        const env = setup();
        if (missing) env.document.querySelector(missing).remove();
        env.load('price_and_point_highlighter/main.js');
        await new Promise(setImmediate);
        assert.equal(
            env.document.querySelector('#nav-belt').style.backgroundColor,
            '#ff0000'
        );
        assert.equal(env.notifications.length, 1);
        assert.match(env.notifications[0].text, /358pt/);
        assert.deepEqual(env.requests, []);
    }
});

test('Highlighterは紙ページでKindle版を1回取得し、紙ページを再取得しない', async () => {
    const env = setup(
        fs.readFileSync(
            path.join(__dirname, 'fixtures/paper-rendered.html'),
            'utf8'
        )
    );
    env.window.location.href = 'https://www.amazon.co.jp/dp/4088931939';
    env.responses.set(productURL, productHTML);
    const displayed = env.common.extractAmazonProductInfo(
        env.document,
        env.window.location.href
    );
    assert.equal(displayed.kindlePrice, 715);
    assert.equal(displayed.paperPrice, 715);
    assert.equal(displayed.points, 0);
    env.load('price_and_point_highlighter/main.js');
    await flushRequests();
    assert.deepEqual(env.requests, [productURL]);
    assert.equal(
        env.document.querySelector('#nav-belt').style.backgroundColor,
        '#ff0000'
    );
    assert.equal(env.notifications.length, 1);
    assert.match(env.notifications[0].text, /358pt/);
});

test('紙ページの価格とKindle側の購入価格を比較し、Kindle応答の紙価格で上書きしない', async () => {
    const env = setup(
        fs.readFileSync(
            path.join(__dirname, 'fixtures/paper-rendered.html'),
            'utf8'
        )
    );
    const paperURL = 'https://www.amazon.co.jp/dp/4088931939';
    env.document.querySelector(
        '#apex-pricetopay-accessibility-label'
    ).textContent = '￥1,000';
    env.responses.set(
        productURL,
        productHTML.replace('+358 pt (50%)', '+39 pt (5%)')
    );
    const info = await env.common.fetchAmazonProductInfo(
        env.document,
        paperURL
    );
    assert.equal(info.asin, '4088931939');
    assert.equal(info.paperAsin, '4088931939');
    assert.equal(info.paperPrice, 1000);
    assert.equal(info.kindlePrice, 715);
    assert.equal(info.points, 39);
    assert.match(env.common.evaluateSaleConditions(info), /285/);
    assert.deepEqual(env.requests, [productURL]);
});

test('Highlighterは両形式の価格がレンダリングされるまで待ち、紙との価格差で判定する', async () => {
    const env = setup(productResponseHTML);
    env.window.location.href = 'https://www.amazon.co.jp/dp/B0HP8Q5WSS';
    env.load('price_and_point_highlighter/main.js');
    await flushRequests();
    assert.equal(env.notifications.length, 0);
    assert.deepEqual(env.requests, []);
    env.document.querySelector('#dimension-slot-info-1').innerHTML =
        '<span class="apex-pricetopay-accessibility-label"> ￥1,200 </span>';
    await flushRequests();
    assert.equal(
        env.notifications.length,
        0,
        'Kindle欄の描画も完了するまで待つ'
    );
    env.document.querySelector('#dimension-slot-info-0').innerHTML =
        '<span class="apex-pricetopay-accessibility-label"> ￥979 </span>';
    await flushRequests();
    assert.equal(env.notifications.length, 1);
    assert.match(env.notifications[0].text, /221/);
    assert.deepEqual(env.requests, []);
    env.document
        .querySelector('#dimension-slot-info-1')
        .appendChild(env.document.createElement('span'));
    await flushRequests();
    assert.equal(
        env.notifications.length,
        1,
        '描画後のDOM変更で通知を重複させない'
    );
});

test('HighlighterはKindle版のない紙ページで商品リクエストを出さない', async () => {
    const env = setup(
        fs.readFileSync(
            path.join(__dirname, 'fixtures/paper-rendered.html'),
            'utf8'
        )
    );
    env.window.location.href = 'https://www.amazon.co.jp/dp/4088931939';
    env.document.querySelector('[data-asin="B0CTC5XTDM"]').remove();
    env.load('price_and_point_highlighter/main.js');
    await flushRequests();
    assert.deepEqual(env.requests, []);
    assert.equal(env.notifications.length, 0);
});

test('New Release Checkerは共著者で重複したASINを1回だけ取得・通知・記録する', async () => {
    const env = setup();
    env.common.COMMON_CONFIG.NEW_RELEASE_DAYS = 100000;
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
        { Name: '高瀬わか' },
        { Name: '共著者' }
    ]);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
    env.responses.set(
        'https://www.amazon.co.jp/s',
        searchHTML.replace('高瀬わか', '高瀬わか 共著者')
    );
    const bookURL = 'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2';
    env.responses.set(bookURL, productHTML);
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    assert.equal(env.requests.filter((url) => url === bookURL).length, 1);
    assert.deepEqual(env.tabs, [bookURL]);
    assert.equal(
        JSON.parse(env.stored.get('newReleaseNotifications')).length,
        1
    );
    assert.match(env.notifications.at(-1).text, /1/);
    env.stored.delete('newReleaseNotifications');
    env.responses.set(bookURL, productHTML.replaceAll('￥715', '￥200'));
    await env.unsafeWindow.checkNewReleases();
    assert.equal(
        env.requests.filter((url) => url === bookURL).length,
        1,
        '通知記録を消してもチェック済みASINを再取得しない'
    );
    assert.deepEqual(env.tabs, [bookURL], 'チェック済みの商品を再び開かない');
});

test('通知しなかった商品のチェック済みASINもIndexedDBに残し、別ページで再取得しない', async () => {
    const first = setup();
    const bookURL = 'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2';
    const configure = (env) => {
        env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
            { Name: '高瀬わか' }
        ]);
        env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
        env.responses.set('https://www.amazon.co.jp/s', searchHTML);
        env.load('new_release_checker/main.js');
    };
    first.responses.set(bookURL, productHTML);
    configure(first);
    await first.unsafeWindow.checkNewReleases();
    assert.equal(first.requests.filter((url) => url === bookURL).length, 1);
    assert.deepEqual(first.tabs, [], '2024年発売の本なので通知しない');
    assert.equal(first.stored.has('newReleaseNotifications'), false);
    const store = await first.common.openNewReleaseCheckStore();
    assert.deepEqual(Array.from(await store.getCheckedAsins()), ['B0HHBSR4QZ']);
    store.close();

    const second = setup(productHTML, first.indexedDB);
    configure(second);
    await second.unsafeWindow.checkNewReleases();
    assert.equal(
        second.requests.length,
        3,
        'S3の2件と検索だけで、商品ページを取得しない'
    );
    assert.deepEqual(second.tabs, []);
});

test(
    '商品を一部処理した段階では保存せず、全件処理とタブ表示・通知記録の後に保存する',
    { timeout: 2000 },
    async () => {
        const scenario = setupConcurrentNewReleases(2, 1, 20);
        const { env, pending, expectedURLs } = scenario;
        const checking = env.unsafeWindow.checkNewReleases();
        await waitFor(() => pending.length === 2);
        pending
            .find(
                (entry) => new URL(entry.url).searchParams.get('k') === '著者0'
            )
            .finish();
        await waitFor(() =>
            pending.some((entry) => entry.url === expectedURLs[0])
        );
        pending.find((entry) => entry.url === expectedURLs[0]).finish();
        await waitFor(() => env.logs.some((log) => log.includes('進捗: 1/2')));

        const reloadedPage = setup(productHTML, env.indexedDB);
        const store = await reloadedPage.common.openNewReleaseCheckStore();
        assert.deepEqual(
            Array.from(await store.getCheckedAsins()),
            [],
            '途中で開き直しても未完了の実行のASINはチェック済みにならない'
        );
        assert.equal(env.tabs.length, 0);
        assert.equal(env.stored.has('newReleaseNotifications'), false);

        while (pending.length > 0) {
            pending[0].finish();
            await flushRequests();
        }
        await checking;
        assert.equal(env.tabs.length, 2);
        assert.equal(
            JSON.parse(env.stored.get('newReleaseNotifications')).length,
            2
        );
        assert.deepEqual(Array.from(await store.getCheckedAsins()), [
            'B0TEST0000',
            'B0TEST0001'
        ]);
        store.close();
    }
);

test('通知記録の保存失敗は従来どおりログで扱い、追加の例外停止をしない', async () => {
    const env = setup();
    env.common.COMMON_CONFIG.NEW_RELEASE_DAYS = 100000;
    const bookURL = 'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2';
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
        { Name: '高瀬わか' }
    ]);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
    env.responses.set('https://www.amazon.co.jp/s', searchHTML);
    env.responses.set(bookURL, productHTML);
    env.localStorage.setItem = () => {
        throw new Error('storage write failed');
    };
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    const store = await env.common.openNewReleaseCheckStore();
    assert.deepEqual(Array.from(await store.getCheckedAsins()), ['B0HHBSR4QZ']);
    assert.equal(env.notifications.length, 1);
    assert.equal(env.notifications[0].title, '📚 新刊チェック完了');
    store.close();
});

test('商品取得が失敗したASINはチェック済みにせず、次の実行で確認する', async () => {
    const env = setup();
    const bookURL = 'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2';
    env.responses.set(env.common.COMMON_CONFIG.AUTHORS_URL, [
        { Name: '高瀬わか' }
    ]);
    env.responses.set(env.common.COMMON_CONFIG.EXCLUDED_KEYWORDS_URL, []);
    env.responses.set('https://www.amazon.co.jp/s', searchHTML);
    env.responses.set(bookURL, (request) =>
        request.onload({ status: 503, responseText: '' })
    );
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    const store = await env.common.openNewReleaseCheckStore();
    assert.deepEqual(Array.from(await store.getCheckedAsins()), []);
    env.responses.set(bookURL, productHTML);
    await env.unsafeWindow.checkNewReleases();
    assert.equal(env.requests.filter((url) => url === bookURL).length, 2);
    assert.deepEqual(Array.from(await store.getCheckedAsins()), ['B0HHBSR4QZ']);
    store.close();
});

test('IndexedDBの初期化に失敗したら通知して停止し、記録なしで取得を続けない', async () => {
    const env = setup();
    env.indexedDB.open = () => {
        throw new Error('IndexedDB unavailable');
    };
    env.load('new_release_checker/main.js');
    await env.unsafeWindow.checkNewReleases();
    assert.deepEqual(env.requests, []);
    assert.equal(env.notifications.length, 1);
    assert.match(env.notifications[0].text, /IndexedDB unavailable/);
});

test('Highlighterはセール条件未達でも両形式があれば記録する', async () => {
    const env = setup(productHTML.replace('+358 pt (50%)', '+39 pt (5%)'));
    env.load('price_and_point_highlighter/main.js');
    await new Promise(setImmediate);
    assert.equal(env.notifications.length, 0);
    assert.ok(JSON.parse(env.stored.get('markedASINs')).B0CTC5XTDM);
});

test('Highlighterは共通のシリーズ解析・判定結果で通知とハイライトを行う', async () => {
    const env = setup(
        fs.readFileSync(
            path.join(__dirname, 'fixtures/series-offers.html'),
            'utf8'
        )
    );
    env.window.location.href = 'https://www.amazon.co.jp/dp/B0CZLMJWC3';
    env.load('price_and_point_highlighter/main.js');
    await flushRequests();
    assert.equal(env.notifications.length, 1);
    assert.equal(env.notifications[0].title, 'テストシリーズ');
    assert.match(env.notifications[0].text, /500pt/);
    assert.match(env.notifications[0].text, /平均 300\.00円/);
    assert.equal(
        env.document.querySelector('#nav-belt').style.backgroundColor,
        '#ff0000'
    );
    assert.deepEqual(env.requests, []);
});
