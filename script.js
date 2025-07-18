// ===================================
// GLOBALE VARIABLEN & KONSTANTEN
// ===================================
const gamesPerLoad = 20;
const countdownElements = [];
let countdownIntervalId = null;

const appState = {
    offset: 0,
    searchQuery: '',
    platformFilters: new Set(),
    isTodayFilterActive: false
};

const REGION_EUROPE   = 2;
const STORE_STEAM     = 13;
const STORE_EPIC      = 16;
const STORE_GOG       = 17;
const STORE_OFFICIAL  = 1;

const storePriority = new Map([
    [STORE_STEAM,    1],
    [STORE_EPIC,     2],
    [STORE_GOG,      3],
    [STORE_OFFICIAL, 4]
]);

const platformIconMap = {
    6:   '<i class="fa-brands fa-windows"></i>',
    49:  '<i class="fa-brands fa-xbox"></i>',
    169: '<i class="fa-brands fa-xbox"></i>',
    48:  '<i class="fa-brands fa-playstation"></i>',
    167: '<i class="fa-brands fa-playstation"></i>',
    130: '<i class="fas fa-gamepad nintendo-old"></i>',
    508: '<i class="fas fa-gamepad nintendo-new"></i>'
};

const platformStoreRules = new Map([
    [6,   { type: 'category', ids: [STORE_STEAM, STORE_EPIC, STORE_GOG] }],
    [48,  { type: 'domain',   domains: ['store.playstation.com'] }],
    [167, { type: 'domain',   domains: ['store.playstation.com'] }],
    [49,  { type: 'domain',   domains: ['xbox.com', 'microsoft.com'] }],
    [169, { type: 'domain',   domains: ['xbox.com', 'microsoft.com'] }],
    [130, { type: 'domain',   domains: ['nintendo'] }],
    [508, { type: 'domain',   domains: ['nintendo'] }]
]);


// ===================================
// UTILS
// ===================================
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}


// ===================================
// HAUPTLOGIK & EVENTS
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    const loadMoreBtn          = document.getElementById('load-more-btn');
    const searchInput          = document.getElementById('search-input');
    const searchForm           = document.getElementById('search-form');
    const mainTitle            = document.getElementById('main-title');
    const themeToggle          = document.getElementById('theme-toggle');
    const platformFilter       = document.getElementById('platform-filter');
    const todayFilterBtn       = document.getElementById('today-filter-btn');

    themeToggle?.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
    });

    searchForm.addEventListener('submit', e => e.preventDefault());

    mainTitle.addEventListener('click', resetToUpcomingView);

    todayFilterBtn?.addEventListener('click', () => {
        appState.isTodayFilterActive = !appState.isTodayFilterActive;
        todayFilterBtn.classList.toggle('active', appState.isTodayFilterActive);
        appState.offset = 0;
        fetchAndDisplayGames();
    });

    searchInput.addEventListener('input', debounce(() => {
        appState.searchQuery = searchInput.value.trim();
        appState.offset = 0;
        fetchAndDisplayGames();
    }, 400));

    loadMoreBtn.addEventListener('click', () => {
        appState.offset += gamesPerLoad;
        fetchAndDisplayGames();
    });

    platformFilter?.addEventListener('change', () => {
        appState.platformFilters.clear();
        platformFilter
            .querySelectorAll('input[type=checkbox]:checked')
            .forEach(cb => appState.platformFilters.add(parseInt(cb.value, 10)));
        appState.offset = 0;
        fetchAndDisplayGames();
    });

    fetchAndDisplayGames();
});

function fetchAndDisplayGames() {
    const { offset, searchQuery, platformFilters, isTodayFilterActive } = appState;
    fetchGamesFromAPI(offset, searchQuery, platformFilters, isTodayFilterActive);
}


// ===================================
// API-FUNKTIONEN
// ===================================
function fetchGamesFromAPI(offset, query = '', platformIds = new Set(), isTodayFilter) {
    const conditions = [];
    const sort       = 'sort first_release_date asc;';

    // Datum ab Mitternacht heute oder nur heute
    let dateCondition;

    // KORREKTUR 1: Die Logik für den "Heute"-Filter wurde angepasst,
    // um die lokale Zeitzone des Benutzers korrekt zu berücksichtigen.
    if (isTodayFilter) {
        const now = new Date();
        // Start des heutigen Tages in der lokalen Zeitzone des Benutzers
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        // Ende des heutigen Tages in der lokalen Zeitzone des Benutzers
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        // Konvertiere die lokalen Zeitpunkte in UTC-Timestamps für die API-Abfrage
        const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
        const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

        dateCondition = `(first_release_date >= ${startTimestamp} & first_release_date <= ${endTimestamp})`;
    } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dateCondition = `(first_release_date >= ${Math.floor(today.getTime()/1000)})`;
    }
    conditions.push(dateCondition);

    if (query) {
        conditions.push(`(name ~ *"${query}"*)`);
    }

    if (platformIds.size) {
        conditions.push(`(platforms = (${[...platformIds].join(',')}))`);
    }

    const whereClause = conditions.join(' & ');
    const body = `
        fields
            id,
            name,
            cover.url,
            first_release_date,
            websites.*,
            platforms.id,
            platforms.name,
            release_dates.*;
        where ${whereClause};
        ${sort}
        limit ${gamesPerLoad};
        offset ${offset};
    `;

    executeFetch(body, query, isTodayFilter);
}

function executeFetch(body, query = '', isTodayFilter = false) {
    const loader         = document.getElementById('loader');
    const gamesContainer = document.getElementById('games-container');
    const loadMoreBtn    = document.getElementById('load-more-btn');

    if (appState.offset === 0) {
        gamesContainer.innerHTML = '';
        loader.style.display     = 'block';
    }
    loadMoreBtn.style.display = 'none';

    fetch('/api/igdb', {
        method: 'POST',
        body
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`);
        return res.json();
    })
    .then(games => {
        loader.style.display = 'none';

        if (!games.length && appState.offset === 0) {
            let msg = 'Keine Spiele für die aktuelle Auswahl gefunden.';
            if (isTodayFilter) {
                msg = query
                    ? `Keine heute erschienenen Spiele für "${query}" gefunden.`
                    : 'Heute sind keine Releases verfügbar.';
            } else if (query) {
                msg = `Keine kommenden Spiele für „${query}“ gefunden.`;
            }
            gamesContainer.innerHTML = `<p class="info-text">${msg}</p>`;
            return;
        }

        displayGames(games, isTodayFilter);
        loadMoreBtn.style.display = games.length < gamesPerLoad ? 'none' : 'inline-block';
    })
    .catch(err => {
        console.error('API-Fehler:', err);
        loader.style.display = 'none';
        gamesContainer.innerHTML = `<p class="info-text">Ein Fehler ist aufgetreten.</p>`;
    });
}


// ===================================
// DARSTELLUNG & COUNTDOWN
// ===================================
function displayGames(games, isTodayFilter = false) {
    const gamesContainer = document.getElementById('games-container');

    if (appState.offset === 0) {
        countdownElements.length = 0;
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }

    const fragment = document.createDocumentFragment();

    games.forEach(game => {
        const placeholderSVG = 'data:image/svg+xml;charset=UTF-8,...';
        const coverUrl       = game.cover
            ? game.cover.url.replace('t_thumb', 't_cover_big')
            : placeholderSVG;

        const icons = new Set();
        (game.platforms || []).forEach(p => {
            if (platformIconMap[p.id]) icons.add(platformIconMap[p.id]);
        });
        const platformIcons = [...icons].join(' ');

        const bestTs  = getBestReleaseTimestamp(game.release_dates, game.first_release_date);
        const relDate = bestTs ? new Date(bestTs * 1000) : null;
        let dateStr   = 'Datum unbekannt';
        if (relDate) {
            const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
            dateStr = isTodayFilter
                ? 'Heute erschienen!'
                : `Erscheint am: ${relDate.toLocaleDateString('de-DE', opts)}`;
        }

        const storeLink   = getStoreLink(game);
        const wrapperTag  = storeLink ? 'a' : 'div';
        const wrapperAttr = storeLink ? `href="${storeLink}" target="_blank" rel="noopener noreferrer"` : '';

        const card = document.createElement('div');
        card.classList.add('game-card');
        card.innerHTML = `
            <${wrapperTag} class="game-image-container" style="background-image:url(${coverUrl})" ${wrapperAttr}>
                <img src="${coverUrl}" alt="Cover von ${game.name}" class="game-image" loading="lazy">
            </${wrapperTag}>
            <div class="card-content">
                <div class="card-header">
                    <h2 class="game-title">${game.name}</h2>
                    <div class="platform-icons">${platformIcons}</div>
                </div>
                <p class="release-date">${dateStr}</p>
                <div class="countdown-timer" id="timer-${game.id}"></div>
            </div>
        `;
        fragment.appendChild(card);

        const timerEl = card.querySelector('.countdown-timer');
        if (isTodayFilter) {
            timerEl.textContent = '🎉 Veröffentlicht!';
        }
        // KORREKTUR 2: Die Countdown-Logik verwendet nun direkt den UTC-Timestamp,
        // um einen zeitzonenunabhängigen und konsistenten Countdown zu gewährleisten.
        else if (bestTs && bestTs * 1000 > Date.now()) {
            // Der `bestTs` ist bereits der korrekte UTC-Timestamp in Sekunden.
            // Wir verwenden ihn direkt für den Countdown.
            countdownElements.push({ elementId: `timer-${game.id}`, timestamp: bestTs });
        } else if (bestTs) { // Wenn bereits veröffentlicht
            timerEl.textContent = '🎉 Veröffentlicht!';
        }
        else {
            timerEl.style.display = 'none';
        }
    });

    gamesContainer.appendChild(fragment);

    if (!countdownIntervalId && countdownElements.length) {
        countdownIntervalId = setInterval(updateCountdowns, 1000);
    }
}

function updateCountdowns() {
    const now = Date.now();
    for (let i = countdownElements.length - 1; i >= 0; i--) {
        const { elementId, timestamp } = countdownElements[i];
        const el = document.getElementById(elementId);
        if (!el) {
            countdownElements.splice(i, 1);
            continue;
        }
        const diff = timestamp * 1000 - now;
        if (diff <= 0) {
            el.textContent = '🎉 Veröffentlicht!';
            countdownElements.splice(i, 1);
            continue;
        }
        const days    = Math.floor(diff / 86400000);
        const hours   = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        el.textContent = `${days}T ${hours}h ${minutes}m ${seconds}s`;
    }
    if (!countdownElements.length) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }
}


// ===================================
// HILFSFUNKTIONEN
// ===================================
function resetToUpcomingView() {
    document.getElementById('search-input').value = '';
    appState.isTodayFilterActive = false;
    document.getElementById('today-filter-btn')?.classList.remove('active');
    appState.searchQuery = '';
    appState.offset      = 0;
    fetchAndDisplayGames();
}

function getBestReleaseTimestamp(releaseDates, fallback) {
    if (!Array.isArray(releaseDates) || !releaseDates.length) return fallback;
    const eu = releaseDates.find(d => d.region === REGION_EUROPE);
    return eu?.date || releaseDates[0].date || fallback;
}

function localizeUrl(urlString, gameName) {
    if (!urlString) return null;
    if (urlString.includes('nintendo.com')) {
        const q = encodeURIComponent(gameName);
        return `https://www.nintendo.de/Suche/Suche-299117.html?q=${q}`;
    }
    if (urlString.includes('store.steampowered.com')) {
        try {
            const u = new URL(urlString);
            u.searchParams.set('l', 'german');
            return u.toString();
        } catch {
            return urlString;
        }
    }
    return urlString.replace(/\/en-[a-zA-Z]{2}\//, '/de-de/') || urlString;
}

function getStoreLink(game) {
    const { websites = [], name } = game;
    const activeFilters = appState.platformFilters;

    if (!websites.length) return null;

    const findByDomain   = d => websites.find(w => w.url.includes(d));
    const findByCategory = c => websites.find(w => w.category === c);

    if (activeFilters.size) {
        for (const pf of activeFilters) {
            const rule = platformStoreRules.get(pf);
            if (!rule) continue;
            if (rule.type === 'domain') {
                for (const dom of rule.domains) {
                    const site = findByDomain(dom);
                    if (site) return localizeUrl(site.url, name);
                }
            } else {
                for (const cid of rule.ids) {
                    const site = findByCategory(cid);
                    if (site) return localizeUrl(site.url, name);
                }
            }
        }
    }

    let bestLink     = null;
    let bestPriority = Infinity;
    for (const w of websites) {
        const prio = storePriority.get(w.category);
        if (typeof prio === 'number' && prio < bestPriority) {
            bestPriority = prio;
            bestLink     = w.url;
        }
    }
    return localizeUrl(bestLink, name);
}


// ===================================
// EXTERNE DIENSTE (Analytics & Cookie Consent)
// ===================================
function loadGoogleAnalytics() {
    const MID = 'G-9MTCLGZVDD';
    if (window.gtag) return;
    const s1 = document.createElement('script');
    s1.async = true;
    s1.src   = `https://www.googletagmanager.com/gtag/js?id=${MID}`;
    document.head.appendChild(s1);

    const s2 = document.createElement('script');
    s2.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${MID}');
    `;
    document.head.appendChild(s2);
}

window.addEventListener('load', () => {
    window.cookieconsent.initialise({
        palette: {
            popup:  { background: '#2a2a2a', text: '#f0f0f0' },
            button: { background: '#9146ff' }
        },
        theme: 'classic',
        position: 'bottom',
        type: 'opt-in',
        revokable: false,
        content: {
            message: "Wir würden gerne Cookies für Analyse-Zwecke verwenden.",
            allow:   'Akzeptieren',
            deny:    'Ablehnen',
            link:    'Mehr erfahren',
            href:    '/datenschutz.html'
        },
        onStatusChange() {
            if (this.hasConsented()) loadGoogleAnalytics();
        }
    });
});