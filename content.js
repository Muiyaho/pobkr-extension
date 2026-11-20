(() => {
    document.documentElement.dataset.pobkrExtension = chrome.runtime.getManifest().version;
    window.addEventListener('message', event => {
        if (event.source !== window || event.origin !== window.location.origin)
            return;
        const data = event.data;
        if (!data || data.type !== 'pobkr-extension-request' || typeof data.id !== 'string')
            return;
        const message = data.kind === 'account' || data.kind === 'login'
            ? { type: data.kind, host: data.host }
            : data.kind === 'trade'
                ? { type: 'trade', url: data.url, body: typeof data.body === 'string' ? data.body : undefined }
                : data.kind === 'mine-characters' || data.kind === 'mine-character'
                    ? { type: data.kind, realm: data.realm, character: data.character }
                    : data.kind === 'mine-stash'
                        ? { type: 'mine-stash', realm: data.realm, league: data.league, tab: data.tab }
                        : { type: 'fetch', url: data.url };
        chrome.runtime.sendMessage(message, result => {
            const answer = chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : result;
            window.postMessage({ type: 'pobkr-extension-response', id: data.id, result: answer }, window.location.origin);
        });
    });
    const waiting = new Map();
    window.addEventListener('message', event => {
        if (event.source !== window || event.origin !== window.location.origin)
            return;
        const data = event.data;
        const answer = data && data.type === 'pobkr-site-response' && waiting.get(data.id);
        if (answer)
            answer(data.result);
    });
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (sender.id !== chrome.runtime.id || message?.type !== 'pobkr-site')
            return false;
        const id = crypto.randomUUID();
        const timer = setTimeout(() => {
            waiting.delete(id);
            sendResponse({ error: 'noAnswer' });
        }, 15_000);
        waiting.set(id, result => {
            clearTimeout(timer);
            waiting.delete(id);
            sendResponse(result && typeof result === 'object' ? result : { error: 'noAnswer' });
        });
        window.postMessage({ type: 'pobkr-site-request', id, kind: message.kind, slot: message.slot, item: message.item }, window.location.origin);
        return true;
    });
})();
