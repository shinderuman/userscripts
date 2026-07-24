(function () {
    'use strict';

    const PAGE_WINDOW =
        typeof unsafeWindow === 'undefined' ? window : unsafeWindow;

    const CONFIG = Object.freeze({
        duplicateMilliseconds: 1200,
        maximumDecodeDepth: 4,
        maximumWrapperDepth: 5,
        toastDisplayMilliseconds: 3000,
        toastTransitionMilliseconds: 500,
        toastShowDelayMilliseconds: 100
    });

    const PATTERN = Object.freeze({
        intentPath:
            /^\/(?:intent\/(?:tweet|post)|share|compose\/(?:tweet|post))\/?$/i,
        legacyPath: /^\/(?:home)?\/?$/i,
        customPath: /^\/(?:tweet|post)\/?$/i,
        wrapperName:
            /^(?:url|uri|u|target|to|dest|destination|redirect|redirect_url|redirect_uri|continue|next|href|link|share|intent)$/i,
        candidateAttribute:
            /(?:^|[-_:])(?:href|url|uri|intent|share|target|dest|destination|redirect|action)(?:$|[-_:])/i,
        handlerAttribute:
            /^on(?:click|auxclick|mousedown|mouseup|pointerdown|pointerup|touchstart|touchend|keydown|keyup|submit)$/i,
        embeddedIntent:
            /(?:(?:https?:)?\/\/)?(?:[a-z0-9-]+\.)*(?:twitter\.com|x\.com)\/(?:intent\/(?:tweet|post)|share|compose\/(?:tweet|post))\/?(?:[?#][^\s'"`<>]*)?|(?:twitter|x):\/\/(?:(?:intent\/(?:tweet|post))|(?:tweet|post))\/?(?:[?#][^\s'"`<>]*)?/gi
    });

    const EVENT_CONFIG = Object.freeze({
        eventNames: ['click', 'auxclick', 'keydown', 'submit'],
        activationKeys: ['Enter', ' ', 'Spacebar']
    });

    const STATE = {
        lastIntentUrl: '',
        lastCaptureTime: 0,
        nativeWindowOpen: PAGE_WINDOW.open
    };

    const initApp = () => {
        installDocumentListeners();
        installWindowOpenHook();
        installElementClickHook(
            PAGE_WINDOW.HTMLAnchorElement?.prototype,
            'anchor.click'
        );
        installElementClickHook(
            PAGE_WINDOW.HTMLAreaElement?.prototype,
            'area.click'
        );
        installFormHook('submit');
        installFormHook('requestSubmit');
        installUrlMethodHook(
            PAGE_WINDOW.Location?.prototype,
            'assign',
            'location.assign'
        );
        installUrlMethodHook(
            PAGE_WINDOW.Location?.prototype,
            'replace',
            'location.replace'
        );
        installHistoryHook('pushState');
        installHistoryHook('replaceState');
        installNavigationHook();
        console.debug('[X Intent Copier] Initialized.');
    };

    const toText = (value) => {
        try {
            return value == null ? '' : String(value?.url ?? value);
        } catch (error) {
            console.error('[X Intent Copier] String conversion failed.', {
                value,
                error
            });
            return '';
        }
    };

    const decodeNamedHtmlEntity = (name) =>
        ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[
            name.toLowerCase()
        ] ?? `&${name};`;

    const decodeHtmlEntities = (value) =>
        value.replace(
            /&(?:#(\d+)|#x([0-9a-f]+)|(amp|quot|apos|lt|gt));/gi,
            (match, decimal, hexadecimal, name) => {
                try {
                    if (decimal) {
                        return String.fromCodePoint(
                            Number.parseInt(decimal, 10)
                        );
                    }
                    if (hexadecimal) {
                        return String.fromCodePoint(
                            Number.parseInt(hexadecimal, 16)
                        );
                    }
                    return decodeNamedHtmlEntity(name);
                } catch (error) {
                    console.error(
                        '[X Intent Copier] HTML entity decoding failed.',
                        { match, error }
                    );
                    return match;
                }
            }
        );

    const decodeCodePoint = (match, hexadecimal) => {
        try {
            return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
        } catch (error) {
            console.error(
                '[X Intent Copier] JavaScript escape decoding failed.',
                { match, hexadecimal, error }
            );
            return match;
        }
    };

    const decodeJavaScriptEscapes = (value) =>
        value
            .replace(/\\u\{([0-9a-f]+)\}/gi, decodeCodePoint)
            .replace(/\\u([0-9a-f]{4})/gi, decodeCodePoint)
            .replace(/\\x([0-9a-f]{2})/gi, decodeCodePoint)
            .replace(/\\\//g, '/')
            .replace(/\\([\\'"`])/g, '$1');

    const appendDecodedValues = (decodedValues, value) => {
        decodedValues.add(value);
        decodedValues.add(decodeHtmlEntities(value));
        decodedValues.add(decodeJavaScriptEscapes(value));
        decodedValues.add(decodeJavaScriptEscapes(decodeHtmlEntities(value)));
    };

    const createDecodedValues = (value) => {
        const decodedValues = new Set();
        let currentValue = toText(value);
        for (let depth = 0; depth < CONFIG.maximumDecodeDepth; depth += 1) {
            appendDecodedValues(decodedValues, currentValue);
            try {
                const decodedValue = decodeURIComponent(currentValue);
                if (decodedValue === currentValue) {
                    break;
                }
                currentValue = decodedValue;
            } catch (error) {
                console.debug('[X Intent Copier] URL decoding skipped.', {
                    value: currentValue,
                    error
                });
                break;
            }
        }
        return decodedValues;
    };

    const cleanUrlCandidate = (value) =>
        toText(value)
            .trim()
            .replace(/^[\s'"`(<\[{]+/, '')
            .replace(/[\s'"`)>\]},;]+$/, '');

    const normalizeUrlCandidate = (value) => {
        let normalizedValue = cleanUrlCandidate(
            decodeJavaScriptEscapes(decodeHtmlEntities(value))
        );
        if (/^(?:www\.)?(?:twitter\.com|x\.com)\//i.test(normalizedValue)) {
            normalizedValue = `https://${normalizedValue}`;
        }
        if (
            /^(?:[a-z0-9-]+\.)+(?:twitter\.com|x\.com)\//i.test(normalizedValue)
        ) {
            normalizedValue = `https://${normalizedValue}`;
        }
        if (normalizedValue.startsWith('//')) {
            normalizedValue = `${location.protocol}${normalizedValue}`;
        }
        return normalizedValue;
    };

    const createUrl = (value, baseUrl = document.baseURI || location.href) => {
        const normalizedValue = normalizeUrlCandidate(value);
        if (!normalizedValue) {
            return null;
        }
        try {
            return new URL(normalizedValue, baseUrl);
        } catch (error) {
            console.debug('[X Intent Copier] URL parsing skipped.', {
                value: normalizedValue,
                error
            });
            return null;
        }
    };

    const isTwitterHost = (hostname) => {
        const normalizedHostname = hostname.toLowerCase().replace(/\.$/, '');
        return (
            normalizedHostname === 'twitter.com' ||
            normalizedHostname.endsWith('.twitter.com') ||
            normalizedHostname === 'x.com' ||
            normalizedHostname.endsWith('.x.com')
        );
    };

    const isCustomSchemeIntentUrl = (url) => {
        if (!['twitter:', 'x:'].includes(url.protocol)) {
            return false;
        }
        const hostname = url.hostname.toLowerCase();
        if (hostname === 'intent') {
            return PATTERN.customPath.test(url.pathname);
        }
        return (
            ['tweet', 'post'].includes(hostname) && /^\/?$/.test(url.pathname)
        );
    };

    const isWebIntentUrl = (url) => {
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }
        if (!isTwitterHost(url.hostname)) {
            return false;
        }
        if (PATTERN.intentPath.test(url.pathname)) {
            return true;
        }
        return (
            PATTERN.legacyPath.test(url.pathname) &&
            url.searchParams.has('status')
        );
    };

    const isDirectIntentUrl = (url) =>
        Boolean(url) && (isWebIntentUrl(url) || isCustomSchemeIntentUrl(url));

    const findEmbeddedIntentUrl = (value, baseUrl) => {
        PATTERN.embeddedIntent.lastIndex = 0;
        for (const match of value.matchAll(PATTERN.embeddedIntent)) {
            const parsedUrl = createUrl(match[0], baseUrl);
            if (isDirectIntentUrl(parsedUrl)) {
                return parsedUrl.href;
            }
        }
        return '';
    };

    const findDirectIntentUrl = (value, baseUrl) => {
        const parsedUrl = createUrl(value, baseUrl);
        if (isDirectIntentUrl(parsedUrl)) {
            return parsedUrl.href;
        }
        return findEmbeddedIntentUrl(value, baseUrl);
    };

    const collectNestedValues = (parsedUrl) => {
        const preferredValues = [];
        const remainingValues = [];
        for (const [name, value] of parsedUrl.searchParams.entries()) {
            if (!value) {
                continue;
            }
            if (PATTERN.wrapperName.test(name)) {
                preferredValues.push(value);
                continue;
            }
            remainingValues.push(value);
        }
        const hash = parsedUrl.hash.replace(/^#/, '');
        if (hash) {
            preferredValues.push(hash);
            try {
                const hashParameters = new URLSearchParams(
                    hash.startsWith('?') ? hash.slice(1) : hash
                );
                for (const [name, value] of hashParameters.entries()) {
                    if (!value) {
                        continue;
                    }
                    if (PATTERN.wrapperName.test(name)) {
                        preferredValues.push(value);
                        continue;
                    }
                    remainingValues.push(value);
                }
            } catch (error) {
                console.error(
                    '[X Intent Copier] Hash parameter parsing failed.',
                    { hash, error }
                );
            }
        }
        return [...preferredValues, ...remainingValues];
    };

    const findNestedIntentUrl = (value, baseUrl, depth, visitedValues) => {
        const parsedUrl = createUrl(value, baseUrl);
        if (!parsedUrl || depth >= CONFIG.maximumWrapperDepth) {
            return '';
        }
        for (const nestedValue of collectNestedValues(parsedUrl)) {
            const intentUrl = findIntentUrl(
                nestedValue,
                parsedUrl.href,
                depth + 1,
                visitedValues
            );
            if (intentUrl) {
                return intentUrl;
            }
        }
        return '';
    };

    const findIntentUrl = (
        value,
        baseUrl = document.baseURI || location.href,
        depth = 0,
        visitedValues = new Set()
    ) => {
        const rawValue = toText(value);
        if (
            !rawValue ||
            visitedValues.has(rawValue) ||
            depth > CONFIG.maximumWrapperDepth
        ) {
            return '';
        }
        visitedValues.add(rawValue);
        for (const decodedValue of createDecodedValues(rawValue)) {
            const directIntentUrl = findDirectIntentUrl(decodedValue, baseUrl);
            if (directIntentUrl) {
                return directIntentUrl;
            }
            const nestedIntentUrl = findNestedIntentUrl(
                decodedValue,
                baseUrl,
                depth,
                visitedValues
            );
            if (nestedIntentUrl) {
                return nestedIntentUrl;
            }
        }
        return '';
    };

    const getParameterValues = (searchParameters, name) =>
        searchParameters
            .getAll(name)
            .map((value) => value.trim())
            .filter(Boolean);

    const appendIntentVia = (parts, searchParameters) => {
        const accountName = searchParameters
            .get('via')
            ?.trim()
            .replace(/^@+/, '');
        if (accountName) {
            parts.push(`via @${accountName}`);
        }
    };

    const appendIntentHashtags = (parts, searchParameters) => {
        const hashtags = new Set();
        const values = [
            ...getParameterValues(searchParameters, 'hashtags'),
            ...getParameterValues(searchParameters, 'hashtag')
        ];
        for (const value of values) {
            for (const rawHashtag of value.split(/[\s,]+/)) {
                const hashtag = rawHashtag.trim().replace(/^#+/, '');
                if (hashtag) {
                    hashtags.add(`#${hashtag}`);
                }
            }
        }
        parts.push(...hashtags);
    };

    const createClipboardText = (searchParameters) => {
        const text = (
            searchParameters.get('text') ??
            searchParameters.get('message') ??
            searchParameters.get('status') ??
            ''
        )
            .replace(/\r\n?/g, '\n')
            .trim();
        const parts = text ? [text] : [];
        parts.push(...getParameterValues(searchParameters, 'url'));
        appendIntentVia(parts, searchParameters);
        appendIntentHashtags(parts, searchParameters);
        return parts.length ? `${parts.join('\n')}\n\n` : '';
    };

    const parseIntentUrl = (intentUrl) => {
        const parsedUrl = createUrl(intentUrl);
        if (!isDirectIntentUrl(parsedUrl)) {
            return null;
        }
        return {
            intentUrl: parsedUrl.href,
            clipboardText: createClipboardText(parsedUrl.searchParams)
        };
    };

    const copyWithExecCommand = (text) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.readOnly = true;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        (document.body || document.documentElement).appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        return copied;
    };

    const copyToClipboard = async (text) => {
        try {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(text, 'text');
                return true;
            }
            if (
                typeof GM === 'object' &&
                typeof GM.setClipboard === 'function'
            ) {
                await GM.setClipboard(text, 'text');
                return true;
            }
            if (typeof navigator.clipboard?.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (error) {
            console.error('[X Intent Copier] Clipboard API failed.', {
                text,
                error
            });
        }
        try {
            return copyWithExecCommand(text);
        } catch (error) {
            console.error('[X Intent Copier] execCommand copy failed.', {
                text,
                error
            });
            return false;
        }
    };

    const openOriginalIntentUrl = (url) => {
        try {
            Reflect.apply(STATE.nativeWindowOpen, PAGE_WINDOW, [url, '_blank']);
        } catch (error) {
            console.error(
                '[X Intent Copier] Failed to open original Intent URL.',
                { url, error }
            );
        }
    };

    const showToast = (
        headerText,
        message,
        url = null,
        backgroundColor = '#333',
        headerBackgroundColor = '#444'
    ) => {
        const toast = document.createElement('div');
        const toastHeader = document.createElement('div');
        const toastBody = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.width = '250px';
        toast.style.backgroundColor = backgroundColor;
        toast.style.color = '#fff';
        toast.style.borderRadius = '5px';
        toast.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        toast.style.zIndex = 'calc(infinity)';
        toast.style.cursor = 'pointer';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        toastHeader.textContent = headerText;
        toastHeader.style.backgroundColor = headerBackgroundColor;
        toastHeader.style.padding = '10px';
        toastHeader.style.fontWeight = 'bold';
        toastHeader.style.borderTopLeftRadius = '5px';
        toastHeader.style.borderTopRightRadius = '5px';
        toastBody.textContent = message;
        toastBody.style.padding = '10px';
        toastBody.style.fontSize = '14px';
        toast.appendChild(toastHeader);
        toast.appendChild(toastBody);
        if (url) {
            toast.onclick = () => {
                openOriginalIntentUrl(url);
                toast.remove();
            };
        }
        const mountTarget = document.body || document.documentElement;
        if (!mountTarget) {
            console.error(
                '[X Intent Copier] Toast mount target was not found.',
                { headerText, message, url }
            );
            return;
        }
        mountTarget.appendChild(toast);
        PAGE_WINDOW.setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, CONFIG.toastShowDelayMilliseconds);
        PAGE_WINDOW.setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            PAGE_WINDOW.setTimeout(() => {
                toast.remove();
            }, CONFIG.toastTransitionMilliseconds);
        }, CONFIG.toastDisplayMilliseconds);
    };

    const showErrorToast = (message, url = null) =>
        showToast('Error', message, url, '#e74c3c', '#c0392b');

    const isDuplicateCapture = (intentUrl) => {
        const currentTime = Date.now();
        if (
            STATE.lastIntentUrl === intentUrl &&
            currentTime - STATE.lastCaptureTime < CONFIG.duplicateMilliseconds
        ) {
            return true;
        }
        STATE.lastIntentUrl = intentUrl;
        STATE.lastCaptureTime = currentTime;
        return false;
    };

    const captureIntent = async (value, source) => {
        const intentUrl = findIntentUrl(value);
        if (!intentUrl) {
            return false;
        }
        if (isDuplicateCapture(intentUrl)) {
            return true;
        }
        const intent = parseIntentUrl(intentUrl);
        if (!intent) {
            showErrorToast('Error: Failed to parse the Intent URL.');
            return true;
        }
        if (!intent.clipboardText.trim()) {
            showErrorToast(
                'Error: The URL parameter is missing or empty, and no URL is found in the text.',
                intent.intentUrl
            );
            return true;
        }
        if (!(await copyToClipboard(intent.clipboardText))) {
            showErrorToast(
                'Error: Failed to copy to the clipboard.',
                intent.intentUrl
            );
            return true;
        }
        showToast('X Intent Copier', intent.clipboardText, intent.intentUrl);
        console.debug('[X Intent Copier] Intent captured.', {
            source,
            intentUrl: intent.intentUrl,
            clipboardText: intent.clipboardText
        });
        return true;
    };

    const isElement = (node) =>
        node?.nodeType === 1 && typeof node.getAttribute === 'function';

    const hasTagName = (node, ...tagNames) =>
        tagNames.includes(String(node?.tagName ?? '').toUpperCase());

    const appendCandidate = (candidates, value) => {
        const candidate = toText(value).trim();
        if (candidate) {
            candidates.push(candidate);
        }
    };

    const buildFormUrl = (form, submitter = null) => {
        if (!hasTagName(form, 'FORM')) {
            return '';
        }
        try {
            const action =
                submitter?.getAttribute?.('formaction') ||
                submitter?.formAction ||
                form.getAttribute('action') ||
                form.action ||
                document.URL;
            const url = new URL(action, document.baseURI || location.href);
            const formData = new FormData(form);
            if (submitter?.name) {
                formData.append(submitter.name, submitter.value ?? '');
            }
            for (const [name, value] of formData.entries()) {
                if (typeof value === 'string') {
                    url.searchParams.append(name, value);
                }
            }
            return url.href;
        } catch (error) {
            console.error('[X Intent Copier] Form URL creation failed.', {
                form,
                submitter,
                error
            });
            return form.action || '';
        }
    };

    const appendElementCandidates = (candidates, node) => {
        if (hasTagName(node, 'A', 'AREA')) {
            appendCandidate(candidates, node.href);
            appendCandidate(candidates, node.getAttribute('href'));
        }
        if (hasTagName(node, 'FORM')) {
            appendCandidate(candidates, buildFormUrl(node));
        }
        if (hasTagName(node, 'BUTTON', 'INPUT')) {
            appendCandidate(candidates, node.formAction);
            appendCandidate(candidates, node.getAttribute('formaction'));
            if (node.form) {
                appendCandidate(candidates, buildFormUrl(node.form, node));
            }
        }
    };

    const appendAttributeCandidates = (candidates, node) => {
        for (const attribute of node.attributes ?? []) {
            if (
                ['href', 'action', 'formaction'].includes(attribute.name) ||
                PATTERN.candidateAttribute.test(attribute.name) ||
                PATTERN.handlerAttribute.test(attribute.name)
            ) {
                appendCandidate(candidates, attribute.value);
            }
        }
        for (const value of Object.values(node.dataset ?? {})) {
            appendCandidate(candidates, value);
        }
    };

    const appendHandlerCandidates = (candidates, node) => {
        for (const handlerName of [
            'onclick',
            'onauxclick',
            'onmousedown',
            'onmouseup',
            'onpointerdown',
            'onpointerup',
            'ontouchstart',
            'ontouchend',
            'onkeydown',
            'onkeyup',
            'onsubmit'
        ]) {
            try {
                if (typeof node[handlerName] === 'function') {
                    appendCandidate(
                        candidates,
                        Function.prototype.toString.call(node[handlerName])
                    );
                }
            } catch (error) {
                console.error(
                    '[X Intent Copier] Event handler inspection failed.',
                    { handlerName, node, error }
                );
            }
        }
    };

    const collectNodeCandidates = (node) => {
        if (!isElement(node)) {
            return [];
        }
        const candidates = [];
        appendElementCandidates(candidates, node);
        appendAttributeCandidates(candidates, node);
        appendHandlerCandidates(candidates, node);
        return candidates;
    };

    const createFallbackEventPath = (target) => {
        const path = [];
        let currentNode = target;
        while (currentNode) {
            path.push(currentNode);
            currentNode = currentNode.parentNode || currentNode.host || null;
        }
        return path;
    };

    const getEventPath = (event) =>
        typeof event.composedPath === 'function'
            ? event.composedPath()
            : createFallbackEventPath(event.target);

    const findIntentFromEvent = (event) => {
        for (const node of getEventPath(event)) {
            for (const candidate of collectNodeCandidates(node)) {
                const intentUrl = findIntentUrl(candidate);
                if (intentUrl) {
                    return intentUrl;
                }
            }
        }
        return '';
    };

    const stopEvent = (event) => {
        if (event.cancelable) {
            event.preventDefault();
        }
        event.stopPropagation();
        event.stopImmediatePropagation();
    };

    const handleActivationEvent = (event) => {
        if (
            event.type === 'keydown' &&
            !EVENT_CONFIG.activationKeys.includes(event.key)
        ) {
            return;
        }
        const intentUrl = findIntentFromEvent(event);
        if (!intentUrl) {
            return;
        }
        stopEvent(event);
        void captureIntent(intentUrl, `event:${event.type}`);
    };

    const createPatchedMethod = (originalMethod, applyHandler) =>
        new Proxy(originalMethod, { apply: applyHandler });

    const assignPatchedMethod = (target, methodName, patchedMethod) => {
        try {
            target[methodName] = patchedMethod;
            if (target[methodName] === patchedMethod) {
                return true;
            }
        } catch (error) {
            console.error(
                '[X Intent Copier] Direct method assignment failed.',
                { target, methodName, error }
            );
        }
        try {
            Object.defineProperty(target, methodName, {
                configurable: true,
                writable: true,
                value: patchedMethod
            });
            return true;
        } catch (error) {
            console.error(
                '[X Intent Copier] defineProperty method patch failed.',
                { target, methodName, error }
            );
            return false;
        }
    };

    const patchMethod = (target, methodName, applyHandler) => {
        if (!target) {
            return false;
        }
        let originalMethod;
        try {
            originalMethod = target[methodName];
        } catch (error) {
            console.error('[X Intent Copier] Target method read failed.', {
                target,
                methodName,
                error
            });
            return false;
        }
        if (typeof originalMethod !== 'function') {
            return false;
        }
        return assignPatchedMethod(
            target,
            methodName,
            createPatchedMethod(originalMethod, applyHandler)
        );
    };

    const installDocumentListeners = () => {
        for (const eventName of EVENT_CONFIG.eventNames) {
            document.addEventListener(eventName, handleActivationEvent, true);
        }
    };

    const installWindowOpenHook = () => {
        patchMethod(PAGE_WINDOW, 'open', (target, thisValue, argumentsList) => {
            const intentUrl = findIntentUrl(argumentsList[0]);
            if (intentUrl) {
                void captureIntent(intentUrl, 'window.open');
                return null;
            }
            return Reflect.apply(target, thisValue, argumentsList);
        });
    };

    const installElementClickHook = (prototype, source) => {
        patchMethod(prototype, 'click', (target, thisValue, argumentsList) => {
            const intentUrl = findIntentUrl(
                thisValue.href || thisValue.getAttribute?.('href')
            );
            if (intentUrl) {
                void captureIntent(intentUrl, source);
                return undefined;
            }
            return Reflect.apply(target, thisValue, argumentsList);
        });
    };

    const installFormHook = (methodName) => {
        patchMethod(
            PAGE_WINDOW.HTMLFormElement?.prototype,
            methodName,
            (target, thisValue, argumentsList) => {
                const intentUrl = findIntentUrl(
                    buildFormUrl(thisValue, argumentsList[0] ?? null)
                );
                if (intentUrl) {
                    void captureIntent(intentUrl, `form.${methodName}`);
                    return undefined;
                }
                return Reflect.apply(target, thisValue, argumentsList);
            }
        );
    };

    const installUrlMethodHook = (prototype, methodName, source) => {
        patchMethod(
            prototype,
            methodName,
            (target, thisValue, argumentsList) => {
                const intentUrl = findIntentUrl(argumentsList[0]);
                if (intentUrl) {
                    void captureIntent(intentUrl, source);
                    return undefined;
                }
                return Reflect.apply(target, thisValue, argumentsList);
            }
        );
    };

    const installHistoryHook = (methodName) => {
        patchMethod(
            PAGE_WINDOW.History?.prototype,
            methodName,
            (target, thisValue, argumentsList) => {
                const intentUrl = findIntentUrl(argumentsList[2]);
                if (intentUrl) {
                    void captureIntent(intentUrl, `history.${methodName}`);
                    return undefined;
                }
                return Reflect.apply(target, thisValue, argumentsList);
            }
        );
    };

    const installNavigationHook = () => {
        if (typeof PAGE_WINDOW.navigation?.addEventListener !== 'function') {
            return;
        }
        try {
            PAGE_WINDOW.navigation.addEventListener(
                'navigate',
                (event) => {
                    const intentUrl = findIntentUrl(event.destination?.url);
                    if (!intentUrl) {
                        return;
                    }
                    stopEvent(event);
                    void captureIntent(intentUrl, 'navigation');
                },
                { capture: true }
            );
        } catch (error) {
            console.error('[X Intent Copier] Navigation hook failed.', {
                error
            });
        }
    };

    initApp();
})();
