const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { DOMParser: HTMLParser } = require('linkedom');
const { IDBFactory: TestIDBFactory } = require('fake-indexeddb');

const source = fs.readFileSync(path.join(__dirname, '../common.js'), 'utf8');
const fixture = (name) =>
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const parse = (html) => new HTMLParser().parseFromString(html, 'text/html');
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(setImmediate);

// 純粋な解析・判定のテストにはGM API、window、document、storageを渡さない。
function loadCommon(overrides = {}) {
    const context = {
        unsafeWindow: {},
        URL,
        console: { log() {}, warn() {}, error() {} },
        ...overrides
    };
    vm.runInNewContext(source, context);
    return context.unsafeWindow.KindleCommon;
}

test('商品解析は通信・現在のページに依存せず、引数のHTMLとURLから情報を返す', () => {
    const common = loadCommon();
    const info = common.extractAmazonProductInfo(
        parse(fixture('product-response.html')),
        'https://www.amazon.co.jp/dp/B0HP8Q5WSS?tag=test'
    );
    assert.equal(typeof info.then, 'undefined');
    assert.equal(info.asin, 'B0HP8Q5WSS');
    assert.equal(info.kindlePrice, 979);
    assert.equal(info.points, 10);
    assert.equal(info.paperAsin, '4040766342');
    assert.equal(info.paperBookAvailable, true);
    assert.equal(info.kindleBookAvailable, true);
    assert.equal(info.releaseDate.getFullYear(), 2026);
    assert.equal(info.releaseDate.getMonth(), 10);
    assert.equal(info.releaseDate.getDate(), 9);
    assert.equal(info.paperPrice, 0, '別ページの紙価格は解析中に取得しない');
});

test('4049723255のMedia Matrix表示を紙あり・Kindleなしと判定する', () => {
    const common = loadCommon();
    const doc = parse(fixture('paper-media-matrix.html'));
    assert.deepEqual(plain(common.extractBookFormats(doc)), {
        kindle: null,
        paper: { label: 'コミック (紙)', asin: '4049723255', price: null }
    });
    const info = common.extractAmazonProductInfo(
        doc,
        'https://www.amazon.co.jp/dp/4049723255?tag=shinderuman03-22'
    );
    assert.equal(
        info.title,
        '俺に都合が良すぎる街 ~支配者スキルで異世界ハーレム無双~ 2'
    );
    assert.equal(info.paperBookAvailable, true);
    assert.equal(info.kindleBookAvailable, false);
});

test('未対応の形式名を紙版だと推測しない', () => {
    const common = loadCommon();
    const doc = parse(fixture('paper-singleton.html'));
    doc.querySelector(
        '#inline-twister-expanded-dimension-text-media_format'
    ).textContent = '不明な形式';
    assert.deepEqual(plain(common.getBookAvailability(doc)), {
        paperBookAvailable: false,
        kindleBookAvailable: false
    });
});

test('シリーズ解析は最大の冊オファーを選び、話のまとめ買いと別オファーの情報を混ぜない', () => {
    const { extractAmazonSeriesInfo } = loadCommon();
    // 移動前の既存セレクタが要求する構造を使ったテストデータ。
    const doc = parse(fixture('series-offers.html'));
    assert.deepEqual(plain(extractAmazonSeriesInfo(doc)), {
        bookCount: 20,
        seriesPrice: 6000,
        seriesPoints: 500,
        hasSeriesCoupon: true,
        seriesCouponText: '20%OFF'
    });
    assert.equal(extractAmazonSeriesInfo(parse('<div></div>')), null);
});

test('クーポン情報は商品解析から取得できる', () => {
    const { extractAmazonProductInfo } = loadCommon();
    const doc = parse(
        '<i class="a-icon a-icon-addon newCouponBadge">クーポン:</i><span class="couponLabelText">10%OFF<a>詳細</a></span>'
    );
    const info = extractAmazonProductInfo(doc);
    assert.equal(info.hasCoupon, true);
    assert.equal(info.couponText, '10%OFF');
});

test('検索結果の解析はタイトル・絶対URL・ASIN・著者情報を返す', () => {
    const common = loadCommon();
    const books = common.extractAmazonSearchBooks(
        parse(fixture('search.html'))
    );
    assert.equal(books.length, 1);
    assert.equal(books[0].asin, 'B0HHBSR4QZ');
    assert.equal(
        books[0].url,
        'https://www.amazon.co.jp/ebook/dp/B0HHBSR4QZ/ref=sr_1_2?keywords=test'
    );
    assert.ok(books[0].authors.includes('高瀬わか'));
    assert.equal(
        common.extractAmazonSearchBooks(
            parse(fixture('search.html').repeat(12))
        ).length,
        10
    );
});

test('検索結果の実際の発売日・購入価格属性を読み、欠落と0円を区別する', () => {
    const common = loadCommon();
    const books = common.extractAmazonSearchBooks(
        parse(fixture('search-metadata.html'))
    );
    assert.equal(books[0].kindlePrice, 979);
    assert.equal(books[0].releaseDate.getFullYear(), 2026);
    assert.equal(books[0].releaseDate.getMonth(), 10);
    assert.equal(books[0].releaseDate.getDate(), 9);
    assert.equal(books[1].releaseDate, null);
    assert.equal(books[1].kindlePrice, 88);
    assert.equal(books[2].releaseDate.getFullYear(), 2023);
    assert.equal(books[3].kindlePrice, 0);
    const noPurchaseAttribute = common.extractAmazonSearchBooks(
        parse(fixture('search.html'))
    )[0];
    assert.equal(
        noPurchaseAttribute.kindlePrice,
        null,
        '一般の価格表示から購入価格を推測しない'
    );
    assert.equal(noPurchaseAttribute.releaseDate, null);
});

test('新刊候補のISBNモード0・1・2と通知済み・除外キーワード・著者の判定', () => {
    const common = loadCommon();
    const kindle = {
        title: '対象の本',
        url: 'https://www.amazon.co.jp/dp/B0HHBSR4QZ',
        asin: 'B0HHBSR4QZ',
        authors: ['高瀬わか']
    };
    const paper = {
        ...kindle,
        asin: '4088931939',
        url: 'https://www.amazon.co.jp/dp/4088931939'
    };
    const options = {
        authorName: '高瀬わか',
        excludedKeywords: [],
        excludedAsins: new Set(),
        isbnMode: 0
    };
    const select = (changes) =>
        Array.from(
            common.selectNewReleaseCandidates([kindle, paper], {
                ...options,
                ...changes
            }),
            (book) => book.asin
        );
    assert.deepEqual(select({}), ['B0HHBSR4QZ']);
    assert.deepEqual(select({ isbnMode: 1 }), ['4088931939']);
    assert.deepEqual(select({ isbnMode: 2 }), ['B0HHBSR4QZ', '4088931939']);
    assert.deepEqual(select({ isbnMode: 999 }), ['B0HHBSR4QZ']);
    assert.deepEqual(select({ excludedAsins: new Set(['B0HHBSR4QZ']) }), []);
    assert.deepEqual(select({ excludedKeywords: ['対象'] }), []);
    assert.deepEqual(select({ authorName: '別の著者' }), []);
    assert.deepEqual(select({ authorName: '高瀬 わか' }), []);
    assert.equal(
        common.selectNewReleaseCandidates([{ ...kindle, url: '' }], options)
            .length,
        0
    );
});

test('チェック済みASINだけを保存し、旧データの確認時刻を削除してもASINを失わない', async () => {
    const indexedDB = new TestIDBFactory();
    const openDatabase = (version) =>
        new Promise((resolve, reject) => {
            const request = indexedDB.open('KindleNewReleaseChecker', version);
            request.onupgradeneeded = () =>
                request.result.createObjectStore('checkedAsins');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    const oldDB = await openDatabase(1);
    await new Promise((resolve, reject) => {
        const transaction = oldDB.transaction('checkedAsins', 'readwrite');
        const store = transaction.objectStore('checkedAsins');
        store.put(1793320000000, 'B0HHBSR4QZ');
        store.put(1793320000001, 'B0CTC5XTDM');
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
    });
    oldDB.close();
    const store = await loadCommon({ indexedDB }).openNewReleaseCheckStore();
    assert.deepEqual(Array.from(await store.getCheckedAsins()), [
        'B0CTC5XTDM',
        'B0HHBSR4QZ'
    ]);
    await store.markCheckedAsins(['B0HP8Q5WSS']);
    store.close();
    const db = await openDatabase(2);
    await new Promise((resolve, reject) => {
        const transaction = db.transaction('checkedAsins', 'readonly');
        const objectStore = transaction.objectStore('checkedAsins');
        const keys = objectStore.getAllKeys();
        const values = objectStore.getAll();
        transaction.oncomplete = () => {
            try {
                assert.deepEqual(keys.result, [
                    'B0CTC5XTDM',
                    'B0HHBSR4QZ',
                    'B0HP8Q5WSS'
                ]);
                assert.deepEqual(values.result, [null, null, null]);
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        transaction.onabort = () => reject(transaction.error);
    });
    db.close();
});

test('チェック済みASINの一括保存でエラーが起きても、一部だけ保存しない', async () => {
    const indexedDB = new TestIDBFactory();
    const store = await loadCommon({ indexedDB }).openNewReleaseCheckStore();
    await assert.rejects(store.markCheckedAsins(['B0HHBSR4QZ', null]), {
        name: 'DataError'
    });
    assert.deepEqual(Array.from(await store.getCheckedAsins()), []);
    await store.markCheckedAsins(['B0HHBSR4QZ', 'B0HP8Q5WSS']);
    assert.deepEqual(Array.from(await store.getCheckedAsins()), [
        'B0HHBSR4QZ',
        'B0HP8Q5WSS'
    ]);
    store.close();
});

test('新刊判定は指定した発売日と最低価格の境界を維持する', () => {
    const { isNewRelease } = loadCommon();
    const cutoff = new Date('2026-10-23T00:00:00+09:00');
    const book = {
        releaseDate: new Date(cutoff.getTime() + 1),
        kindlePrice: 222
    };
    assert.equal(isNewRelease(book, cutoff), true);
    assert.equal(isNewRelease({ ...book, releaseDate: cutoff }, cutoff), false);
    assert.equal(isNewRelease({ ...book, releaseDate: null }, cutoff), false);
    assert.equal(isNewRelease({ ...book, kindlePrice: 221 }, cutoff), false);
    assert.equal(isNewRelease({ ...book, kindlePrice: 0 }, cutoff), false);
    assert.equal(isNewRelease({ ...book, kindlePrice: null }, cutoff), true);
});

test('発売日は登録情報から解析し、期間限定無料の終了日を読まない', () => {
    const common = loadCommon();
    assert.equal(
        common.extractReleaseDate(parse(fixture('product.html'))).getFullYear(),
        2024
    );
    assert.equal(
        common.extractReleaseDate(
            parse('<footer>2026/11/4 23:59 まで無料</footer>')
        ),
        null
    );
    assert.equal(
        common.parseDateFromText('発売予定日は2026年11月9日です。').getDate(),
        9
    );
    assert.equal(common.parseDateFromText(''), null);
});

test('セール判定はポイント・還元率・紙価格差の閾値と価格上限を維持する', () => {
    const { evaluateSaleConditions } = loadCommon();
    const book = {
        title: '本',
        points: 0,
        kindlePrice: 600,
        paperPrice: 0,
        hasCoupon: false
    };
    assert.equal(evaluateSaleConditions(book), null);
    assert.match(
        evaluateSaleConditions({ ...book, points: 171, kindlePrice: 1000 }),
        /ポイント 171pt/
    );
    assert.match(evaluateSaleConditions({ ...book, points: 120 }), /20\.00%/);
    assert.match(
        evaluateSaleConditions({ ...book, paperPrice: 771 }),
        /価格差 171円/
    );
    assert.equal(evaluateSaleConditions({ ...book, paperPrice: 770 }), null);
    assert.equal(evaluateSaleConditions({ ...book, paperPrice: 1800 }), null);
    assert.equal(
        evaluateSaleConditions({
            ...book,
            title: 'ヤングジャンプ 2026 No.1',
            kindlePrice: 200,
            paperPrice: 600
        }),
        null
    );
    assert.match(
        evaluateSaleConditions({ ...book, hasCoupon: true }),
        /クーポンあり/
    );
});

test('シリーズ判定はDOMなしでポイント・平均価格・クーポンを評価する', () => {
    const { evaluateSeriesSaleConditions } = loadCommon();
    const info = {
        bookCount: 2,
        seriesPrice: 700,
        seriesPoints: 0,
        hasSeriesCoupon: false,
        seriesCouponText: ''
    };
    assert.match(evaluateSeriesSaleConditions(info), /平均 350\.00円/);
    assert.equal(
        evaluateSeriesSaleConditions({ ...info, seriesPrice: 701 }),
        null
    );
    assert.match(
        evaluateSeriesSaleConditions({
            ...info,
            seriesPrice: 1000,
            seriesPoints: 171
        }),
        /171pt/
    );
    assert.match(
        evaluateSeriesSaleConditions({
            ...info,
            seriesPrice: 1000,
            hasSeriesCoupon: true,
            seriesCouponText: '10%引き'
        }),
        /10%引き/
    );
    assert.equal(
        evaluateSeriesSaleConditions({
            ...info,
            bookCount: 0,
            seriesPoints: 500
        }),
        null
    );
});

test('共通ASIN解析はHighlighterが既に扱っていた3種類のURLに対応する', () => {
    const { extractAsinFromUrl } = loadCommon();
    for (const prefix of ['dp', 'gp/product', 'kindle-dbs/product']) {
        assert.equal(
            extractAsinFromUrl(
                `https://www.amazon.co.jp/${prefix}/B0HHBSR4QZ?tag=test`
            ),
            'B0HHBSR4QZ'
        );
    }
    assert.equal(extractAsinFromUrl('https://www.amazon.co.jp/s?k=test'), null);
});

test('fetchDocumentは検索条件を保持し、fetchPageInfoは商品URLのクエリを除去する', async () => {
    const requests = [];
    const common = loadCommon({
        DOMParser: HTMLParser,
        GM_xmlhttpRequest(request) {
            requests.push(request.url);
            request.onload({
                status: 200,
                responseText: '<span id="productTitle">本</span>'
            });
        }
    });
    const searchURL = 'https://www.amazon.co.jp/s?k=test&s=date-desc-rank';
    assert.equal(
        (await common.fetchDocument(searchURL)).querySelector('#productTitle')
            .textContent,
        '本'
    );
    const clean = await common.fetchPageInfo(
        'https://www.amazon.co.jp/dp/B0HHBSR4QZ?tag=test',
        (_doc, url) => url
    );
    assert.equal(clean, 'https://www.amazon.co.jp/dp/B0HHBSR4QZ');
    assert.deepEqual(requests, [searchURL, clean]);
    await assert.rejects(
        common.fetchPageInfo(clean, () => {
            throw new Error('解析失敗');
        }),
        /解析失敗/
    );
    await assert.rejects(
        common.fetchPageInfo(clean, async () => {
            throw new Error('非同期解析失敗');
        }),
        /非同期解析失敗/
    );
});

test('HTTP失敗は空の結果に変換せず通知してrejectする', async () => {
    const notifications = [];
    const common = loadCommon({
        GM_notification: (info) => notifications.push(info),
        GM_xmlhttpRequest: (request) =>
            request.onload({ status: 503, responseText: '' })
    });
    await assert.rejects(
        common.fetchDocument('https://www.amazon.co.jp/dp/4049723255', '本'),
        (error) => error.status === 503
    );
    assert.equal(notifications.length, 1);
});

test('リミッターは同期例外でも枠を解放する', async () => {
    const run = loadCommon().createRequestLimiter(1);
    const results = await Promise.allSettled([
        run(() => {
            throw new Error('失敗');
        }),
        run(() => 42)
    ]);
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[1].value, 42);
});

test('バッジの期限は現在時刻を指定して境界と未記録を検証できる', () => {
    const { isBadgeExpired } = loadCommon();
    assert.equal(isBadgeExpired('1000', 300000, 300999), false);
    assert.equal(isBadgeExpired('1000', 300000, 301000), true);
    assert.equal(isBadgeExpired(undefined, 300000, 301000), false);
});

test('共通バッチ処理は並列数・バッチ間隔・入力順を維持し、最終バッチ後は待機しない', async () => {
    const timers = [];
    const common = loadCommon({
        setTimeout(resolve, delay) {
            timers.push({ resolve, delay });
        }
    });
    const pending = [];
    const started = [];
    const result = common.processBatch(
        [1, 2, 3, 4, 5],
        (item) => {
            started.push(item);
            return new Promise((resolve) =>
                pending.push(() => resolve(item * 2))
            );
        },
        { CONCURRENT_REQUESTS: 2, REQUEST_DELAY: 1000 }
    );
    assert.deepEqual(started, [1, 2]);
    pending.pop()();
    await flush();
    assert.equal(
        timers.length,
        0,
        '同じバッチの全件が完了するまで次に進まない'
    );
    pending.pop()();
    await flush();
    assert.deepEqual(started, [1, 2]);
    timers[0].resolve();
    await flush();
    assert.deepEqual(started, [1, 2, 3, 4]);
    pending.pop()();
    pending.pop()();
    await flush();
    timers[1].resolve();
    await flush();
    pending.pop()();
    assert.deepEqual(plain(await result), [2, 4, 6, 8, 10]);
    assert.deepEqual(
        timers.map((timer) => timer.delay),
        [1000, 1000]
    );
    assert.deepEqual(
        plain(
            await common.processBatch([], () => assert.fail('空リスト'), {
                CONCURRENT_REQUESTS: 2,
                REQUEST_DELAY: 1000
            })
        ),
        []
    );
});
