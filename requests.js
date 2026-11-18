const PAGES = [
    /^https:\/\/(?:www\.)?pob\.co\.kr\/pob(?:[/?#]|$)/
];
const HOSTS = new Set(['www.pathofexile.com', 'poe.kakaogames.com']);
const PATHS = /^\/(?:character-window\/get-(?:characters|passive-skills|items)|account\/view-profile\/[^/]+(?:\/characters)?)$/;
export function accountHost(value) {
    return typeof value === 'string' && HOSTS.has(value) ? value : null;
}
export function loginPage(host) {
    return accountHost(host) ? `https://${host}/login` : null;
}
export function allowedPage(url) {
    return typeof url === 'string' && PAGES.some(page => page.test(url));
}
function httpsUrl(value) {
    if (typeof value !== 'string')
        return null;
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return null;
    }
    if (url.protocol !== 'https:' || url.port || url.username || url.password)
        return null;
    return plainPath(url.pathname) ? url : null;
}
function plainPath(path) {
    let decoded;
    try {
        decoded = decodeURIComponent(path);
    }
    catch {
        return false;
    }
    if (decoded.includes('\\') || decoded.split('/').length !== path.split('/').length)
        return false;
    return !decoded.split('/').some(part => part === '.' || part === '..');
}
export function allowedRequest(value) {
    const url = httpsUrl(value);
    return url && HOSTS.has(url.hostname) && PATHS.test(url.pathname) ? url : null;
}
const TRADE_HOST = 'poe.kakaogames.com';
const TRADE_SEARCH = /^\/api\/trade\/search\/[^/]+(?:\/[^/]+)?$/;
const TRADE_FETCH = /^\/api\/trade\/fetch\/[A-Za-z0-9,]+$/;
const MAX_QUERY = 64 * 1024;
export function tradeSearchId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{3,4096}={0,2}$/.test(value) ? value : null;
}
export function allowedTrade(value, body) {
    const url = httpsUrl(value);
    if (!url || url.hostname !== TRADE_HOST)
        return null;
    if (TRADE_FETCH.test(url.pathname))
        return body === undefined ? { url } : null;
    if (!TRADE_SEARCH.test(url.pathname) || url.search || typeof body !== 'string' || body.length > MAX_QUERY)
        return null;
    try {
        const query = JSON.parse(body);
        return query && typeof query === 'object' && !Array.isArray(query) ? { url, body } : null;
    }
    catch {
        return null;
    }
}
export const SITE = 'https://pob.co.kr';
export function allowedTradePage(url) {
    return typeof url === 'string' && /^https:\/\/poe\.kakaogames\.com\/trade(?:[/?#]|$)/.test(url);
}
export function tradeLink(value) {
    const url = httpsUrl(value);
    return url && url.hostname === 'poe.kakaogames.com' && /^\/trade\/(?:search|exchange)\//.test(url.pathname) ? url.toString() : null;
}
