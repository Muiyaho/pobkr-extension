import { SITE, accountHost, allowedPage, allowedRequest, allowedTrade, allowedTradePage, loginPage, tradeLink, tradeSearchId } from './requests.js';
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 10 * 1024 * 1024;
async function ask(url) {
    try {
        const response = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (response.redirected && !allowedRequest(response.url))
            return { error: `다른 주소로 넘어갔습니다: ${response.url.slice(0, 100)}` };
        const body = await response.text();
        if (body.length > MAX_BYTES)
            return { error: '응답이 너무 큽니다' };
        const headers = {};
        for (const [name, value] of response.headers)
            if (name !== 'set-cookie')
                headers[name] = value;
        return { body, headers, status: response.status };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
const TRADE_PER_MINUTE = 40;
const tradeTimes = [];
async function trade({ url, body }) {
    const now = Date.now();
    while (tradeTimes.length && now - tradeTimes[0] >= 60_000)
        tradeTimes.shift();
    if (tradeTimes.length >= TRADE_PER_MINUTE) {
        const seconds = Math.max(1, Math.ceil((tradeTimes[0] + 60_000 - now) / 1000));
        return { body: '{"error":{"code":3,"message":"Rate limit exceeded"}}', headers: { 'retry-after': String(seconds) }, status: 429, statusText: 'Too Many Requests' };
    }
    tradeTimes.push(now);
    try {
        const response = await fetch(url, {
            method: body === undefined ? 'GET' : 'POST',
            credentials: 'include',
            headers: body === undefined ? {} : { 'content-type': 'application/json' },
            body,
            redirect: 'error',
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        const text = await response.text();
        if (text.length > MAX_BYTES)
            return { error: '응답이 너무 큽니다' };
        const headers = {};
        for (const [name, value] of response.headers)
            if (name !== 'set-cookie')
                headers[name] = value;
        return { body: text, headers, status: response.status, statusText: response.statusText };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
async function page(url) {
    const response = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { ok: response.ok, url: response.url, text: response.ok ? await response.text() : '' };
}
async function accountName(host) {
    try {
        const answer = await page(`https://${host}/character-window/get-account-name`);
        if (answer.ok) {
            try {
                const name = JSON.parse(answer.text)?.accountName;
                if (typeof name === 'string' && name)
                    return { accountName: name };
            }
            catch { }
        }
        const account = await page(`https://${host}/my-account`);
        const link = account.ok && new URL(account.url).hostname === host && account.text.match(/\/account\/view-profile\/([^"'/?#<>\s]+)/);
        if (link)
            return { accountName: decodeURIComponent(link[1]) };
        return { loginRequired: true };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
async function bookmarks(list) {
    try {
        const response = await fetch(`${SITE}/api/my/trade-bookmarks`, {
            method: list ? 'PUT' : 'GET',
            credentials: 'include',
            headers: { 'x-pobkr-extension': '1', ...(list ? { 'content-type': 'application/json' } : {}) },
            body: list ? JSON.stringify({ list }) : undefined,
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (response.status === 401)
            return { loginRequired: true };
        const answer = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(answer?.bookmarks))
            return { error: answer?.error ?? `PoB KR이 답하지 않습니다 (${response.status})` };
        return { bookmarks: answer.bookmarks };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
const REALM_HOSTS = { kakao: 'poe.kakaogames.com', pc: 'www.pathofexile.com' };
async function site(path, body) {
    try {
        const response = await fetch(`${SITE}${path}`, {
            method: body === undefined ? 'GET' : body.method ?? 'POST',
            credentials: 'include',
            headers: { 'x-pobkr-extension': '1', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
            body: body === undefined ? undefined : JSON.stringify(body.json),
            signal: AbortSignal.timeout(TIMEOUT_MS * 2)
        });
        const answer = await response.json().catch(() => null);
        if (response.status === 401)
            return { loginRequired: true };
        return response.ok && answer ? answer : { error: answer?.error ?? `PoB KR이 답하지 않습니다 (${response.status})`, retryAfter: answer?.retryAfter };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
async function realmAccount(realm) {
    const host = REALM_HOSTS[realm];
    if (!host)
        return { error: 'badRealm' };
    const found = await accountName(host);
    if (!found.accountName)
        return found.loginRequired ? { realmLogin: realm } : found;
    let name = realm === 'pc' ? found.accountName.replace(/\s+/g, '') : found.accountName;
    name = name.replace(/[#-](\d{4})$/, '#$1');
    return { host, account: name };
}
async function characters(realm) {
    const found = await realmAccount(realm);
    if (!found.account)
        return found;
    const url = allowedRequest(`https://${found.host}/character-window/get-characters?accountName=${encodeURIComponent(found.account)}&realm=pc`);
    const answer = url ? await ask(url) : { error: 'badRequest' };
    if (answer.error || answer.status !== 200)
        return { error: answer.error ?? `character list ${answer.status}` };
    try {
        const list = JSON.parse(answer.body);
        return { characters: (Array.isArray(list) ? list : []).map(char => ({ name: char.name, league: char.league, class: char.class, level: char.level })) };
    }
    catch {
        return { error: 'badCharacterList' };
    }
}
const CHARACTER_KEPT_MS = 5 * 60_000;
const characterKept = new Map();
async function characterNow(main) {
    const key = `${main.realm}\0${main.character}`;
    const kept = characterKept.get(key);
    if (kept && Date.now() - kept.at < CHARACTER_KEPT_MS)
        return kept.data;
    const found = await realmAccount(main.realm);
    if (!found.account)
        return found;
    const query = `accountName=${encodeURIComponent(found.account)}&character=${encodeURIComponent(main.character)}&realm=pc`;
    const items = allowedRequest(`https://${found.host}/character-window/get-items?${query}`);
    const passives = allowedRequest(`https://${found.host}/character-window/get-passive-skills?${query}`);
    if (!items || !passives)
        return { error: 'noCharacter' };
    const [itemsAnswer, passivesAnswer] = [await ask(items), await ask(passives)];
    for (const answer of [itemsAnswer, passivesAnswer]) {
        if (answer.error)
            return { error: answer.error };
        if (answer.status !== 200)
            return { error: answer.status === 429 ? 'realmLimited' : answer.status === 403 || answer.status === 404 ? 'noCharacter' : `character ${answer.status}` };
    }
    const data = { character: { items: itemsAnswer.body, passives: passivesAnswer.body } };
    characterKept.set(key, { data, at: Date.now() });
    return data;
}
async function compareListing(message) {
    const listing = typeof message.listing === 'string' && /^[A-Za-z0-9]{8,128}$/.test(message.listing) ? message.listing : null;
    const search = tradeSearchId(message.search);
    const request = listing && search ? allowedTrade(`https://poe.kakaogames.com/api/trade/fetch/${listing}?query=${encodeURIComponent(search)}`, undefined) : null;
    if (!request)
        return { error: 'badListing' };
    const main = await site('/api/my/main-build');
    if (main.error && !main.loginRequired)
        return main;
    let open = null;
    if (!main.main) {
        const code = await toWebPob({ kind: 'code' }, false);
        if (!code || typeof code.code !== 'string' || !code.code)
            return main.loginRequired ? { loginRequired: true } : { error: 'noMainBuild' };
        open = { build: code.code, buildName: typeof code.name === 'string' ? code.name.slice(0, 100) : '' };
    }
    const answer = await trade(request);
    if (answer.error)
        return { error: answer.error };
    if (answer.status !== 200)
        return { error: answer.status === 429 ? 'tradeLimited' : `trade${answer.status}` };
    let character = {};
    if (main.main?.kind === 'character') {
        character = await characterNow(main.main);
        if (!character.character)
            return character;
    }
    return site('/api/pob/compare', { json: { listing: answer.body, ...character, ...open ?? {} } });
}
async function toWebPob(message, shown) {
    const tabs = (await chrome.tabs.query({})).filter(tab => tab.id !== undefined && allowedPage(tab.url));
    tabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
    const tab = tabs[0];
    if (!tab)
        return null;
    if (shown) {
        await chrome.tabs.update(tab.id, { active: true }).catch(() => { });
        if (tab.windowId !== undefined)
            await chrome.windows.update(tab.windowId, { focused: true }).catch(() => { });
    }
    try {
        return await chrome.tabs.sendMessage(tab.id, { type: 'pobkr-site', ...message });
    }
    catch {
        return { error: 'noAnswer' };
    }
}
async function equipInWebPob(message) {
    const slot = typeof message.slot === 'string' && /^[A-Za-z0-9 ]{1,40}$/.test(message.slot) ? message.slot : null;
    const item = typeof message.item === 'string' && message.item.length <= 20_000 && /^Rarity: /.test(message.item) ? message.item : null;
    if (!slot || !item)
        return { error: 'badItem' };
    const answer = await toWebPob({ kind: 'equip', slot, item }, true);
    if (!answer)
        return { error: 'noWebPob' };
    return answer.ok ? { ok: true } : { error: answer.error ?? 'noAnswer' };
}
function onTradePage(message, sender, sendResponse) {
    if (message.type === 'main') {
        site('/api/my/main-build').then(sendResponse);
        return true;
    }
    if (message.type === 'set-main') {
        site('/api/my/main-build', { method: 'PUT', json: { main: message.main ?? null } }).then(sendResponse);
        return true;
    }
    if (message.type === 'characters') {
        characters(message.realm === 'pc' ? 'pc' : 'kakao').then(sendResponse);
        return true;
    }
    if (message.type === 'realm-login') {
        const url = loginPage(REALM_HOSTS[message.realm === 'pc' ? 'pc' : 'kakao']);
        chrome.tabs.create({ url, index: sender.tab ? sender.tab.index + 1 : undefined })
            .then(() => sendResponse({ ok: true }), error => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
        return true;
    }
    if (message.type === 'compare') {
        compareListing(message).then(sendResponse, error => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
        return true;
    }
    if (message.type === 'equip') {
        equipInWebPob(message).then(sendResponse, error => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
        return true;
    }
    if (message.type === 'bookmarks') {
        bookmarks(Array.isArray(message.list) ? message.list : undefined).then(sendResponse);
        return true;
    }
    if (message.type === 'site-login') {
        chrome.tabs.create({ url: `${SITE}/login`, index: sender.tab ? sender.tab.index + 1 : undefined })
            .then(() => sendResponse({ ok: true }), error => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
        return true;
    }
    const urls = (Array.isArray(message.urls) ? message.urls : []).map(tradeLink).filter(Boolean).slice(0, 30);
    const at = sender.tab ? sender.tab.index + 1 : undefined;
    Promise.all(urls.map((url, idx) => chrome.tabs.create({ url, active: false, index: at === undefined ? undefined : at + idx })))
        .then(() => sendResponse({ ok: true, opened: urls.length }), error => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (['bookmarks', 'site-login', 'open-tabs', 'main', 'set-main', 'characters', 'realm-login', 'compare', 'equip'].includes(message?.type)) {
        if (sender.id !== chrome.runtime.id || !allowedTradePage(sender.url)) {
            sendResponse({ error: 'PoB KR 확장: 이 페이지에서는 쓸 수 없습니다' });
            return false;
        }
        return onTradePage(message, sender, sendResponse);
    }
    if (!['fetch', 'account', 'login', 'trade'].includes(message?.type))
        return false;
    if (sender.id !== chrome.runtime.id || !allowedPage(sender.url)) {
        sendResponse({ error: 'PoB KR 확장: 이 페이지에서는 쓸 수 없습니다' });
        return false;
    }
    if (message.type === 'login') {
        const url = loginPage(message.host);
        if (!url) {
            sendResponse({ error: 'PoB KR 확장: Path of Exile 사이트가 아닙니다' });
            return false;
        }
        chrome.tabs.create({ url, index: sender.tab ? sender.tab.index + 1 : undefined })
            .then(() => sendResponse({ ok: true }), error => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
        return true;
    }
    if (message.type === 'account') {
        const host = accountHost(message.host);
        if (!host) {
            sendResponse({ error: 'PoB KR 확장: Path of Exile 사이트가 아닙니다' });
            return false;
        }
        accountName(host).then(sendResponse);
        return true;
    }
    if (message.type === 'trade') {
        const request = allowedTrade(message.url, message.body);
        if (!request) {
            sendResponse({ error: 'PoB KR 확장: 거래소 검색·조회 말고는 보내지 않습니다' });
            return false;
        }
        trade(request).then(sendResponse);
        return true;
    }
    const url = allowedRequest(message.url);
    if (!url) {
        sendResponse({ error: 'PoB KR 확장: 캐릭터 가져오기 말고는 묻지 않습니다' });
        return false;
    }
    ask(url).then(sendResponse);
    return true;
});
