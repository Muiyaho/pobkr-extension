(() => {
    if (window.top !== window || document.getElementById('pobkr-trade-bookmarks'))
        return;
    const host = document.createElement('div');
    host.id = 'pobkr-trade-bookmarks';
    const root = host.attachShadow({ mode: 'closed' });
    const trusted = handler => event => {
        if (event.isTrusted)
            return handler(event);
    };
    root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
      .open { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; padding: 8px 12px; border-radius: 6px;
        border: 1px solid #c9a45c; background: #18181d; color: #c9a45c; font-size: 13px; font-weight: 700; cursor: pointer; }
      .open:hover { background: #222229; }
      .panel { position: fixed; right: 16px; bottom: 56px; z-index: 2147483000; width: 340px; max-height: 70vh; display: flex;
        flex-direction: column; border: 1px solid #2c2c34; border-radius: 8px; background: #0f0f12; color: #e4e1d8; font-size: 13px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, .5); }
      .panel[hidden] { display: none; }
      header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #2c2c34; }
      header strong { flex: 1; color: #c9a45c; }
      button { font: inherit; font-size: 12px; padding: 4px 8px; border-radius: 4px; border: 1px solid #2c2c34; background: #18181d;
        color: #e4e1d8; cursor: pointer; }
      button:hover:not(:disabled) { border-color: #c9a45c; }
      button:disabled { opacity: .5; cursor: default; }
      button.primary { border-color: #c9a45c; color: #c9a45c; }
      .icon { padding: 2px 6px; color: #8d8a82; }
      .bar { display: flex; gap: 6px; padding: 10px 12px; }
      .bar .primary { flex: 1; }
      .note { padding: 0 12px 10px; color: #8d8a82; font-size: 12px; }
      .error { color: #ff6b6b; }
      ul { list-style: none; margin: 0; padding: 0 6px 6px; overflow-y: auto; }
      li { display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 4px; }
      li:hover { background: #18181d; }
      li.current a { color: #c9a45c; }
      li a { flex: 1; min-width: 0; color: #e4e1d8; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      li a:hover { text-decoration: underline; }
      footer { padding: 8px 12px; border-top: 1px solid #2c2c34; text-align: right; }
      .compare { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-top: 1px solid #2c2c34; }
      .compare label { color: #c9a45c; font-size: 12px; font-weight: 700; }
      select { font: inherit; font-size: 12px; padding: 4px 6px; border-radius: 4px; border: 1px solid #2c2c34; background: #18181d; color: #e4e1d8; }
      .compare .note { padding: 0; }
      .compare .main { color: #e4e1d8; font-size: 12px; }
      .compare .row { display: flex; gap: 6px; }
      .compare .row select { flex: 1; min-width: 0; }
    </style>
    <button class="open" type="button" title="PoB KR 계정에 저장한 거래소 검색">★ 저장한 검색</button>
    <section class="panel" hidden>
      <header><strong>PoB KR 저장한 검색</strong><button class="icon close" type="button" title="닫기">✕</button></header>
      <div class="bar"><button class="primary save" type="button">현재 검색 저장</button></div>
      <p class="note status"></p>
      <ul class="list"></ul>
      <footer><button class="all" type="button">전부 새 탭으로 열기</button></footer>
      <div class="compare">
        <label for="pobkr-main-build">대표 빌드 (즉시 비교 기준)</label>
        <div class="main"></div>
        <div class="row"><select id="pobkr-main-build" class="build"></select><button class="chars" type="button" title="카카오에 로그인된 계정의 캐릭터를 불러옵니다">캐릭터 불러오기</button></div>
        <p class="note">매물의 <b>PoB 비교</b>를 누르면 대표 빌드에 장착했을 때 바뀌는 수치를 매물 아래에 보여 줍니다(PoB KR 서버가 계산). 캐릭터를 고르면 비교할 때 그 캐릭터의 지금 장비로 계산합니다.</p>
      </div>
    </section>`;
    document.documentElement.appendChild(host);
    const $ = selector => root.querySelector(selector);
    const panel = $('.panel');
    const status = $('.status');
    const listEl = $('.list');
    const saveButton = $('.save');
    const allButton = $('.all');
    let list = [];
    let busy = false;
    let loginRequired = false;
    const ask = message => new Promise(resolve => {
        try {
            chrome.runtime.sendMessage(message, result => resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : result ?? { error: '답이 없습니다' }));
        }
        catch (error) {
            resolve({ error: '확장이 새로 고쳐졌습니다. 이 페이지를 새로고침해 주세요.' });
        }
    });
    const currentSearch = () => {
        const path = location.pathname.split('/').filter(Boolean);
        const search = path[0] === 'trade' && (path[1] === 'search' || path[1] === 'exchange');
        const hasQuery = new URLSearchParams(location.search).has('q');
        if (!search || (path.length < 4 && !hasQuery))
            return null;
        return location.origin + location.pathname + location.search;
    };
    const say = (text, error = false) => {
        status.textContent = text;
        status.classList.toggle('error', error);
        status.hidden = !text;
    };
    function render() {
        listEl.textContent = '';
        const current = currentSearch();
        saveButton.disabled = busy || !current;
        allButton.disabled = busy || list.length === 0;
        allButton.textContent = list.length ? `전부 새 탭으로 열기 (${list.length})` : '전부 새 탭으로 열기';
        if (loginRequired) {
            say('PoB KR에 로그인하면 거래소 검색을 계정에 저장할 수 있습니다.');
            const login = document.createElement('button');
            login.type = 'button';
            login.className = 'primary';
            login.textContent = 'PoB KR 로그인';
            login.addEventListener('click', trusted(() => ask({ type: 'site-login' })));
            const item = document.createElement('li');
            item.append(login);
            listEl.append(item);
            saveButton.disabled = true;
            allButton.disabled = true;
            return;
        }
        if (!list.length)
            say(current ? '저장한 검색이 없습니다. 지금 검색을 저장해 보세요.' : '저장한 검색이 없습니다. 거래소에서 검색한 뒤 저장할 수 있습니다.');
        else if (!status.classList.contains('error'))
            say(current ? '' : '검색한 뒤 "현재 검색 저장"을 누를 수 있습니다.');
        for (const bookmark of list) {
            const item = document.createElement('li');
            if (bookmark.url === current)
                item.className = 'current';
            const link = document.createElement('a');
            link.href = bookmark.url;
            link.textContent = bookmark.name;
            link.title = `${bookmark.name}\n저장: ${new Date(bookmark.savedAt).toLocaleString('ko-KR')}`;
            const rename = document.createElement('button');
            rename.type = 'button';
            rename.className = 'icon';
            rename.title = '이름 바꾸기';
            rename.textContent = '✎';
            rename.addEventListener('click', trusted(() => {
                const name = prompt('검색 이름', bookmark.name);
                if (name && name.trim())
                    keep(list.map(other => other === bookmark ? { ...other, name: name.trim() } : other));
            }));
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'icon';
            remove.title = '삭제';
            remove.textContent = '✕';
            remove.addEventListener('click', trusted(() => {
                if (confirm(`"${bookmark.name}"을(를) 저장한 검색에서 지울까요?`))
                    keep(list.filter(other => other !== bookmark));
            }));
            item.append(link, rename, remove);
            listEl.append(item);
        }
    }
    async function load() {
        busy = true;
        say('불러오는 중...');
        render();
        const answer = await ask({ type: 'bookmarks' });
        busy = false;
        loginRequired = Boolean(answer.loginRequired);
        if (loginRequired)
            return render();
        if (answer.error) {
            say(answer.error, true);
            return render();
        }
        list = answer.bookmarks;
        say('');
        render();
    }
    async function keep(next) {
        busy = true;
        render();
        const answer = await ask({ type: 'bookmarks', list: next });
        busy = false;
        loginRequired = Boolean(answer.loginRequired);
        if (loginRequired)
            return render();
        if (answer.error) {
            say(`저장하지 못했습니다: ${answer.error}`, true);
            return render();
        }
        list = answer.bookmarks;
        say('');
        render();
    }
    const defaultName = () => {
        const league = decodeURIComponent(location.pathname.split('/')[3] ?? '').replace(/^pc$/, '') || '검색';
        const when = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `${league} ${when}`;
    };
    saveButton.addEventListener('click', trusted(() => {
        const url = currentSearch();
        if (!url)
            return;
        const known = list.find(bookmark => bookmark.url === url);
        const name = prompt(known ? '이미 저장한 검색입니다. 이름을 바꿀까요?' : '이 검색의 이름', known ? known.name : defaultName());
        if (!name || !name.trim())
            return;
        const others = list.filter(bookmark => bookmark.url !== url);
        keep([{ name: name.trim(), url, savedAt: known ? known.savedAt : new Date().toISOString() }, ...others]);
    }));
    allButton.addEventListener('click', trusted(async () => {
        if (list.length > 10 && !confirm(`저장한 검색 ${list.length}개를 모두 새 탭으로 열까요?`))
            return;
        const answer = await ask({ type: 'open-tabs', urls: list.map(bookmark => bookmark.url) });
        if (answer.error)
            say(answer.error, true);
    }));
    const buildSelect = $('.build');
    const mainLabel = $('.main');
    const charsButton = $('.chars');
    let builds = [];
    let characters = [];
    let main = null;
    let choices = [];
    const describe = value => {
        if (!value)
            return '지정 안 됨: 아래에서 고르세요';
        if (value.kind === 'character')
            return `캐릭터 ${value.character} (${value.realm === 'pc' ? 'pathofexile.com' : '카카오'} · ${value.league})`;
        const build = builds.find(entry => entry.path === value.path);
        return `내 빌드 ${build ? `${build.folder ? `${build.folder}/` : ''}${build.name}` : value.path}`;
    };
    function renderMain() {
        mainLabel.textContent = describe(main);
        buildSelect.textContent = '';
        choices = [];
        buildSelect.append(new Option('대표 빌드 고르기...', ''));
        const group = (label, entries) => {
            if (!entries.length)
                return;
            const element = document.createElement('optgroup');
            element.label = label;
            for (const [text, value] of entries) {
                choices.push(value);
                element.append(new Option(text, String(choices.length - 1)));
            }
            buildSelect.append(element);
        };
        group('내 빌드', builds.map(build => {
            const about = [build.className, build.level ? `${build.level}레벨` : '', build.mainSkill].filter(Boolean).join(' · ');
            return [`${build.folder ? `${build.folder}/` : ''}${build.name}${about ? ` (${about})` : ''}`, { kind: 'build', path: build.path }];
        }));
        group('카카오 캐릭터', characters.map(char => [`${char.name} (${char.league} · ${char.class} ${char.level}레벨)`, { kind: 'character', realm: 'kakao', character: char.name, league: char.league, className: char.class }]));
        buildSelect.value = '';
    }
    async function loadMain() {
        const answer = await ask({ type: 'main' });
        if (answer.loginRequired) {
            mainLabel.textContent = 'PoB KR에 로그인하면 대표 빌드를 정할 수 있습니다.';
            buildSelect.disabled = charsButton.disabled = true;
            return;
        }
        buildSelect.disabled = charsButton.disabled = false;
        if (answer.error) {
            mainLabel.textContent = `대표 빌드를 불러오지 못했습니다: ${answer.error}`;
            return;
        }
        builds = Array.isArray(answer.builds) ? answer.builds : [];
        main = answer.main ?? null;
        renderMain();
    }
    buildSelect.addEventListener('change', trusted(async () => {
        const choice = choices[Number(buildSelect.value)];
        if (!buildSelect.value || !choice)
            return;
        const answer = await ask({ type: 'set-main', main: choice });
        if (answer.error)
            mainLabel.textContent = `정하지 못했습니다: ${answer.error}`;
        else {
            main = answer.main;
            renderMain();
        }
    }));
    charsButton.addEventListener('click', trusted(async () => {
        charsButton.disabled = true;
        const answer = await ask({ type: 'characters', realm: 'kakao' });
        charsButton.disabled = false;
        if (answer.realmLogin) {
            mainLabel.textContent = '카카오(poe.kakaogames.com)에 로그인해야 캐릭터를 불러올 수 있습니다. 새 탭에 로그인 페이지를 엽니다.';
            ask({ type: 'realm-login', realm: 'kakao' });
            return;
        }
        if (answer.error) {
            mainLabel.textContent = `캐릭터를 불러오지 못했습니다: ${answer.error}`;
            return;
        }
        characters = answer.characters ?? [];
        renderMain();
        buildSelect.focus();
    }));
    $('.open').addEventListener('click', trusted(() => {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) {
            load();
            loadMain();
        }
    }));
    $('.close').addEventListener('click', trusted(() => { panel.hidden = true; }));
    let shown = location.href;
    setInterval(() => {
        if (panel.hidden || busy || location.href === shown)
            return;
        shown = location.href;
        render();
    }, 1000);
    const MESSAGES = {
        badListing: '이 매물을 읽지 못했습니다. 검색 결과 주소(검색 id가 붙은 주소)에서 눌러 주세요.',
        noMainBuild: '대표 빌드가 없고 열린 웹 PoB 빌드도 없습니다. 웹 PoB에서 빌드를 열거나, ★ 저장한 검색 패널·PoB KR 내 빌드에서 대표 빌드를 정하세요.',
        badBuild: '웹 PoB에 열린 빌드를 읽지 못했습니다.',
        needCharacter: '대표 캐릭터를 받지 못했습니다. 다시 눌러 주세요.',
        noCharacter: '대표 캐릭터를 찾지 못했습니다. 카카오에 그 캐릭터의 계정으로 로그인돼 있는지, 캐릭터 이름이 바뀌지 않았는지 확인하세요.',
        realmLimited: '카카오 캐릭터 요청 한도에 걸렸습니다. 잠시 뒤 다시 눌러 주세요.',
        unknownItem: 'PoB가 모르는 아이템입니다.',
        noListing: '매물을 PoB 아이템으로 바꾸지 못했습니다.',
        tradeLimited: '거래소 요청 한도에 걸렸습니다. 잠시 뒤 다시 눌러 주세요.',
        tooMany: '비교를 너무 자주 눌렀습니다. 잠시 뒤 다시 눌러 주세요.',
        failed: 'PoB KR 서버가 계산하지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
        loginRequired: '열린 웹 PoB 빌드가 없습니다. 웹 PoB(pob.co.kr/pob)에서 빌드를 열어 두면 로그인 없이 그 빌드로 비교하고, PoB KR에 로그인하면 대표 빌드로 비교합니다.'
    };
    const CODES = ['#000000', '#ff4d4d', '#33ff77', '#8888ff', '#ffff77', '#ff77ff', '#77ffff', '#e4e1d8', '#b3b3b3', '#808080'];
    const colouredLine = text => {
        const line = document.createElement('div');
        line.style.cssText = 'min-height:1em;white-space:pre-wrap';
        let colour = CODES[7];
        let last = 0;
        const pattern = /\^x([0-9A-Fa-f]{6})|\^(\d)/g;
        const add = piece => {
            if (!piece)
                return;
            const span = document.createElement('span');
            span.style.color = colour;
            span.textContent = piece;
            line.append(span);
        };
        for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
            add(text.slice(last, match.index));
            colour = match[1] ? `#${match[1]}` : CODES[Number(match[2])];
            last = pattern.lastIndex;
        }
        add(text.slice(last));
        return line;
    };
    const searchId = () => {
        const path = location.pathname.split('/').filter(Boolean);
        return path[0] === 'trade' && path[1] === 'search' && path.length >= 4 ? path[path.length - 1] : null;
    };
    const SHADES = { '#33ff77': '#4ade80', '#dd0022': '#f87171' };
    const partsLine = (parts, style = '') => {
        const line = document.createElement('div');
        line.style.cssText = `min-height:1em;white-space:pre-wrap;${style}`;
        for (const part of Array.isArray(parts) ? parts : []) {
            const span = document.createElement('span');
            span.textContent = String(part?.text ?? '');
            if (typeof part?.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(part.color))
                span.style.color = SHADES[part.color.toLowerCase()] ?? part.color;
            line.append(span);
        }
        return line;
    };
    const partsText = parts => (Array.isArray(parts) ? parts : []).map(part => String(part?.text ?? '')).join('');
    const SMALL_BUTTON = 'padding:1px 8px;border-radius:3px;border:1px solid #3f3f46;background:transparent;color:#a1a1aa;font:11px "Malgun Gothic",sans-serif;cursor:pointer';
    const EQUIP_ERRORS = {
        noWebPob: '열린 웹 PoB 탭이 없습니다. pob.co.kr/pob에서 빌드를 연 뒤 다시 눌러 주세요.',
        noAnswer: '웹 PoB가 답하지 않습니다. 웹 PoB 탭을 새로고침한 뒤 다시 눌러 주세요.',
        badItem: '이 아이템을 보낼 수 없습니다.'
    };
    function equipButton(item, slot) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '웹 PoB에 장착';
        button.title = `웹 PoB에 열린 빌드의 ${slot} 칸에 넣습니다`;
        button.style.cssText = 'padding:2px 10px;border-radius:3px;border:1px solid #c89b3c;background:rgba(200,155,60,0.12);color:#f0e6d2;font:12px "Malgun Gothic",sans-serif;cursor:pointer';
        const note = document.createElement('span');
        note.style.cssText = 'font-size:11px;color:#a1a1aa';
        button.addEventListener('click', trusted(async (event) => {
            event.preventDefault();
            event.stopPropagation();
            button.disabled = true;
            note.textContent = '보내는 중...';
            const answer = await ask({ type: 'equip', item, slot });
            button.disabled = false;
            note.style.color = answer?.ok ? '#4ade80' : '#f87171';
            note.textContent = answer?.ok ? '웹 PoB에 장착했습니다' : EQUIP_ERRORS[answer?.error] ?? `보내지 못했습니다: ${answer?.error ?? '알 수 없음'}`;
        }));
        wrap.append(button, note);
        return wrap;
    }
    function rowsTable(rows) {
        const table = document.createElement('div');
        table.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;row-gap:1px;align-items:baseline';
        for (const row of rows) {
            const label = document.createElement('div');
            label.textContent = String(row?.label ?? '');
            label.style.cssText = `color:${typeof row?.labelColor === 'string' && /^#[0-9a-f]{3,8}$/i.test(row.labelColor) ? row.labelColor : '#a1a1aa'};overflow-wrap:anywhere`;
            const value = partsLine(row?.value, 'text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums');
            table.append(label, value);
        }
        return table;
    }
    function sectionView(section, item) {
        const view = document.createElement('div');
        const summaryRows = Array.isArray(section.summaryRows) ? section.summaryRows : null;
        const detailRows = Array.isArray(section.detailRows) ? section.detailRows : null;
        const detailCount = (detailRows ?? section.details ?? []).length;
        if (section.replacing)
            view.append(partsLine(section.replacing, 'color:#a1a1aa;margin-bottom:4px'));
        if (summaryRows)
            view.append(rowsTable(summaryRows));
        else
            for (const parts of section.summary ?? [])
                view.append(partsLine(parts));
        if (!(summaryRows ?? section.summary ?? []).length && !detailCount)
            view.append(colouredLine('^8바뀌는 수치가 없습니다.'));
        if (detailCount) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.textContent = `상세 보기 ▾ (${detailCount})`;
            toggle.style.cssText = `margin-top:6px;${SMALL_BUTTON}`;
            const details = document.createElement('div');
            details.style.cssText = 'display:none;margin-top:4px;padding-top:4px;max-height:180px;overflow-y:auto;padding-right:4px;border-top:1px solid #27272a';
            if (detailRows)
                details.append(rowsTable(detailRows));
            else
                for (const parts of section.details)
                    details.append(partsLine(parts));
            toggle.addEventListener('click', trusted(event => {
                event.preventDefault();
                event.stopPropagation();
                const open = details.style.display === 'none';
                details.style.display = open ? 'block' : 'none';
                toggle.textContent = open ? '상세 접기 ▴' : `상세 보기 ▾ (${detailCount})`;
            }));
            view.append(toggle, details);
        }
        if (typeof item === 'string' && typeof section.slot === 'string')
            view.append(equipButton(item, section.slot));
        return view;
    }
    function compareView(box, answer) {
        if (answer.build)
            box.append(colouredLine(`^8PoB KR 즉시 비교 · ${answer.build}`));
        if (answer.sample)
            box.append(colouredLine('^xfbbf24로컬 시험 서버: 계산 서버 없이 미리 만든 반지 비교 결과입니다 (운영은 이 아이템의 칸으로 계산).'));
        const sections = Array.isArray(answer.sections) ? answer.sections : null;
        if (!sections) {
            if (!Array.isArray(answer.lines) || !answer.lines.length)
                box.append(colouredLine('^8바뀌는 수치가 없습니다.'));
            for (const parts of answer.lines ?? [])
                box.append(partsLine(parts));
            return;
        }
        if (!sections.length) {
            box.append(colouredLine('^8바뀌는 수치가 없습니다.'));
            return;
        }
        const views = sections.map(section => sectionView(section, answer.item));
        if (sections.length === 1) {
            box.append(partsLine(sections[0].title, 'font-weight:600;margin:2px 0'), views[0]);
            return;
        }
        const tabs = document.createElement('div');
        tabs.style.cssText = 'display:flex;gap:4px;margin:4px 0 6px;flex-wrap:wrap';
        const buttons = sections.map((section, at) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.textContent = partsText(section.title).replace(/\s*시:\s*$/, '').replace(/:\s*$/, '');
            tab.addEventListener('click', trusted(event => {
                event.preventDefault();
                event.stopPropagation();
                show(at);
            }));
            return tab;
        });
        const show = at => {
            buttons.forEach((tab, other) => { tab.style.cssText = `${SMALL_BUTTON};${other === at ? 'border-color:#c89b3c;color:#f0e6d2;background:rgba(200,155,60,0.12)' : ''}`; });
            views.forEach((view, other) => { view.style.display = other === at ? 'block' : 'none'; });
        };
        tabs.append(...buttons);
        box.append(tabs, ...views);
        show(0);
    }
    async function compareRow(row, button, box) {
        button.disabled = true;
        button.textContent = '비교 중...';
        box.hidden = false;
        box.textContent = '대표 빌드로 계산하는 중...';
        const answer = await ask({ type: 'compare', listing: row.dataset.id, search: searchId() });
        button.disabled = false;
        button.textContent = 'PoB 비교';
        box.textContent = '';
        if (answer.realmLogin) {
            box.append(colouredLine('^xff6b6b대표 캐릭터를 불러오려면 카카오에 로그인해야 합니다. 새 탭에 로그인 페이지를 엽니다.'));
            ask({ type: 'realm-login', realm: answer.realmLogin });
            return;
        }
        if (answer.loginRequired || answer.error) {
            const message = answer.loginRequired ? MESSAGES.loginRequired : answer.error === 'tooMany' && answer.retryAfter ? `${MESSAGES.tooMany} (${answer.retryAfter}초 뒤)` : MESSAGES[answer.error] ?? `비교하지 못했습니다: ${answer.error}`;
            box.append(colouredLine(`^xff6b6b${message}`));
            return;
        }
        compareView(box, answer);
    }
    const BUTTON_STYLE = 'display:inline-flex;align-items:center;margin:0 auto 0 6px;border:1px solid #c89b3c;color:#f0e6d2;background:rgba(200,155,60,0.12);cursor:pointer';
    const LONE_BUTTON_STYLE = 'margin:4px 0 0;padding:3px 8px;border-radius:4px;border:1px solid #c89b3c;background:rgba(200,155,60,0.12);color:#f0e6d2;font:12px "Malgun Gothic",sans-serif;cursor:pointer';
    const BOX_STYLE = 'box-sizing:border-box;width:100%;clear:both;margin-top:8px;padding:8px 10px;background:rgba(15,15,18,0.9);border:1px solid #3f3f46;border-radius:4px;color:#e4e1d8;font:12px/1.5 "Malgun Gothic",sans-serif;text-align:left;white-space:normal';
    const OWN_BUTTON = /은신처로 이동|귓속말|Travel to Hideout|Whisper/;
    function addButtons() {
        if (!searchId())
            return;
        for (const row of document.querySelectorAll('.row[data-id]')) {
            if (row.querySelector('.pobkr-compare'))
                continue;
            const place = row.querySelector('.right') ?? row;
            const own = [...place.querySelectorAll('button')].find(other => OWN_BUTTON.test(other.textContent ?? ''));
            const button = document.createElement('button');
            button.type = 'button';
            button.className = own ? `${own.className} pobkr-compare` : 'pobkr-compare';
            button.textContent = 'PoB 비교';
            button.title = 'PoB KR: 고른 빌드에 장착했을 때 바뀌는 수치';
            button.style.cssText = own ? BUTTON_STYLE : LONE_BUTTON_STYLE;
            const box = document.createElement('div');
            box.className = 'pobkr-compare-result';
            box.hidden = true;
            box.style.cssText = BOX_STYLE;
            button.addEventListener('click', trusted(event => {
                event.preventDefault();
                event.stopPropagation();
                compareRow(row, button, box);
            }));
            if (own) {
                own.after(button);
                const line = own.parentElement && own.parentElement !== place ? own.parentElement : null;
                if (line)
                    line.after(box);
                else {
                    const buttons = [...place.children].filter(child => child.tagName === 'BUTTON');
                    (buttons[buttons.length - 1] ?? button).after(box);
                }
            }
            else {
                place.append(button, box);
            }
        }
    }
    let queued = false;
    new MutationObserver(() => {
        if (queued)
            return;
        queued = true;
        setTimeout(() => {
            queued = false;
            addButtons();
        }, 300);
    }).observe(document.documentElement, { childList: true, subtree: true });
    addButtons();
})();
