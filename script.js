// ===================================
// GLOBALE VARIABLEN & KONSTANTEN
// ===================================
let gameOffset = 0;
const gamesPerLoad = 20;
let currentView = 'upcoming';
let currentSearchQuery = '';
let debounceTimer;
const countdownElements = [];
let countdownIntervalId = null;
let activePlatformFilters = new Set();

const REGION_EUROPE = 2;
const STORE_STEAM = 13;
const STORE_EPIC  = 16;
const STORE_GOG   = 17;
const STORE_OFFICIAL = 1;

const storePriority = new Map([
  [STORE_STEAM,     1],
  [STORE_EPIC,      2],
  [STORE_GOG,       3],
  [STORE_OFFICIAL,  4]
]);

const platformIconMap = {
  6:   '<i class="fa-brands fa-windows"></i>',
  49:  '<i class="fa-brands fa-xbox"></i>',
  169: '<i class="fa-brands fa-xbox"></i>',
  48:  '<i class="fa-brands fa-playstation"></i>',
  167: '<i class="fa-brands fa-playstation"></i>',
  130: '<i class="fas fa-gamepad"></i>'
};

const platformStoreRules = new Map([
  [6,   { type: 'category', ids: [STORE_STEAM, STORE_EPIC, STORE_GOG] }],
  [48,  { type: 'domain', domains: ['store.playstation.com'] }],
  [167, { type: 'domain', domains: ['store.playstation.com'] }],
  [49,  { type: 'domain', domains: ['xbox.com', 'microsoft.com'] }],
  [169, { type: 'domain', domains: ['xbox.com', 'microsoft.com'] }],
  [130, { type: 'domain', domains: ['nintendo.com'] }]
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
// HAUPTLOGIK & EVENT LISTENERS
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    const loadMoreButton = document.getElementById('load-more-btn');
    const searchInput    = document.getElementById('search-input');
    const mainTitle      = document.getElementById('main-title');
    const searchForm     = document.getElementById('search-form');
    const toggleButton   = document.getElementById('theme-toggle');
    const platformFilterContainer = document.getElementById('platform-filter');
    const siteLogo       = document.getElementById('site-logo-img');
    const lightLogoSrc   = './icon/logo-light.png';
    const darkLogoSrc    = './icon/logo-dark.png';

    toggleButton?.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        if (siteLogo) {
            siteLogo.src = document.body.classList.contains('light-mode') ? darkLogoSrc : lightLogoSrc;
        }
    });

    searchForm.addEventListener('submit', e => e.preventDefault());

    mainTitle.addEventListener('click', () => {
        if (currentView !== 'upcoming') resetToUpcomingView();
    });

    searchInput.addEventListener('input', debounce(() => {
        const q = searchInput.value.trim();
        gameOffset = 0;
        if (q) {
            currentView = 'search';
            currentSearchQuery = q;
            fetchSearchResults(q, gameOffset, activePlatformFilters);
        } else if (currentView === 'search') {
            resetToUpcomingView();
        }
    }, 400));

    loadMoreButton.addEventListener('click', () => {
        gameOffset += gamesPerLoad;
        if (currentView === 'upcoming') {
            fetchUpcomingGames(gameOffset, activePlatformFilters);
        } else {
            fetchSearchResults(currentSearchQuery, gameOffset, activePlatformFilters);
        }
    });

    platformFilterContainer?.addEventListener('change', () => {
        activePlatformFilters.clear();
        platformFilterContainer
            .querySelectorAll('input[type=checkbox]:checked')
            .forEach(cb => activePlatformFilters.add(parseInt(cb.value, 10)));
        gameOffset = 0;
        if (currentView === 'search' && currentSearchQuery) {
            fetchSearchResults(currentSearchQuery, gameOffset, activePlatformFilters);
        } else {
            fetchUpcomingGames(gameOffset, activePlatformFilters);
        }
    });

    fetchUpcomingGames(gameOffset, activePlatformFilters);
});


// ===================================
// API-FUNKTIONEN
// ===================================
function fetchGames(body, isSearch = false, query = '') {
    const loader = document.getElementById('loader');
    const gamesContainer = document.getElementById('games-container');
    const loadMoreButton = document.getElementById('load-more-btn');

    if (!gamesContainer) return;

    if (gameOffset === 0) {
        gamesContainer.innerHTML = '';
        if(loader) loader.style.display = 'block';
    }
    if(loadMoreButton) loadMoreButton.style.display = 'none';

    fetch('/api/igdb', { method: 'POST', body })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`);
            return res.json();
        })
        .then(games => {
            if(loader) loader.style.display = 'none';
            if (isSearch && games.length === 0 && gameOffset === 0) {
                gamesContainer.innerHTML = `<p class="info-text">Keine kommenden Spiele für „${query}“ gefunden.</p>`;
                return;
            }
            displayGames(games);
            if(loadMoreButton) {
                loadMoreButton.style.display = games.length < gamesPerLoad ? 'none' : 'inline-block';
            }
        })
        .catch(err => {
            console.error('API-Fehler:', err);
            if(loader) loader.style.display = 'none';
            if(gamesContainer) gamesContainer.innerHTML = `<p class="info-text">Ein Fehler ist aufgetreten.</p>`;
        });
}

function fetchUpcomingGames(offset, platformIds = new Set()) {
  const nowUnix = Math.floor(Date.now() / 1000);
  let where = `first_release_date > ${nowUnix}`;
  if (platformIds.size > 0) {
    where += ` & platforms = (${[...platformIds].join(',')})`;
  }
  const body = `
    fields name, cover.url, first_release_date, websites.*, platforms.id, platforms.name, release_dates.*;
    where ${where};
    sort first_release_date asc;
    limit ${gamesPerLoad};
    offset ${offset};
  `;
  fetchGames(body);
}

function fetchSearchResults(query, offset, platformIds = new Set()) {
  const nowUnix = Math.floor(Date.now() / 1000);
  let where = `name ~ *"${query}"* & first_release_date > ${nowUnix}`;
  if (platformIds.size > 0) {
    where += ` & platforms = (${[...platformIds].join(',')})`;
  }
  const body = `
    fields name, cover.url, first_release_date, websites.*, platforms.id, platforms.name, release_dates.*;
    where ${where};
    limit ${gamesPerLoad};
    offset ${offset};
  `;
  fetchGames(body, true, query);
}


// ===================================
// DARSTELLUNG & COUNTDOWN
// ===================================
function displayGames(games) {
    const gamesContainer = document.getElementById('games-container');
    if (gameOffset === 0) {
        countdownElements.length = 0;
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
    }

    const fragment = document.createDocumentFragment();

    games.forEach(game => {
        const placeholderSVG = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" width="280" height="200" viewBox="0 0 280 200"%3e%3crect fill="%232a2a2a" width="100%" height="100%"/%3e%3ctext fill="%23666" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" font-family="sans-serif"%3eKein Cover%3c/text%3e%3c/svg%3e';
        const coverUrl = game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : placeholderSVG;

        const unique = new Set();
        (game.platforms || []).forEach(p => {
            if (platformIconMap[p.id]) unique.add(platformIconMap[p.id]);
        });
        const platformIcons = [...unique].join(' ');

        const bestTs = getBestReleaseTimestamp(game.release_dates, game.first_release_date);
        const relDate = bestTs ? new Date(bestTs * 1000) : null;
        let dateStr = 'Datum unbekannt';
        if (relDate) {
            const optsDate = { day: '2-digit', month: '2-digit', year: 'numeric' };
            const optsTime = { ...optsDate, hour: '2-digit', minute: '2-digit' };
            dateStr = isMidnightUTC(relDate)
                ? `Erscheint am: ${relDate.toLocaleDateString('de-DE', optsDate)}`
                : `Erscheint am: ${relDate.toLocaleString('de-DE', optsTime)} Uhr`;
        }

        const storeLink = getStoreLink(game.websites, activePlatformFilters);
        const wrapperTag = storeLink ? 'a' : 'div';
        const wrapperAttrs = storeLink ? `href="${storeLink}" target="_blank" rel="noopener noreferrer"` : '';

        const card = document.createElement('div');
        card.classList.add('game-card');
        card.innerHTML = `
            <${wrapperTag} class="game-image-container" style="background-image:url(${coverUrl})" ${wrapperAttrs}>
                <img src="${coverUrl}" alt="Cover von ${game.name}" class="game-image" loading="lazy" />
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

        if (relDate && relDate > new Date()) {
            countdownElements.push({ elementId: `timer-${game.id}`, timestamp: bestTs });
        }
    });

    gamesContainer.appendChild(fragment);

    if (!countdownIntervalId && countdownElements.length > 0) {
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
            el.innerHTML = '🎉 Veröffentlicht!';
            countdownElements.splice(i, 1);
            continue;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerHTML = `${d}T ${h}h ${m}m ${s}s`;
    }
    if (countdownElements.length === 0 && countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }
}

// ===================================
// HILFSFUNKTIONEN
// ===================================
function resetToUpcomingView() {
    const searchInput = document.getElementById('search-input');
    searchInput.value = '';
    gameOffset = 0;
    currentView = 'upcoming';
    fetchUpcomingGames(gameOffset, activePlatformFilters);
}

function getBestReleaseTimestamp(releaseDates, fallback) {
    if (!Array.isArray(releaseDates) || !releaseDates.length) return fallback;
    const eu = releaseDates.find(d => d.region === REGION_EUROPE);
    return eu?.date || releaseDates[0]?.date || fallback;
}

function isMidnightUTC(date) {
    return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
}

function getStoreLink(websites, activeFilters) {
    if (!Array.isArray(websites) || !websites.length) return null;

    const findByDomain = (domain) => websites.find(site => site.url.includes(domain));
    const findByCategory = (catId) => websites.find(site => site.category === catId);

    if (activeFilters instanceof Set && activeFilters.size > 0) {
        for (const platformId of activeFilters) {
            const rule = platformStoreRules.get(platformId);
            if (!rule) continue;
            if (rule.type === 'domain') {
                for (const domain of rule.domains) {
                    const site = findByDomain(domain);
                    if (site) return site.url;
                }
            } else if (rule.type === 'category') {
                for (const categoryId of rule.ids) {
                    const site = findByCategory(categoryId);
                    if (site) return site.url;
                }
            }
        }
    }

    let bestLink = null;
    let bestPriority = Infinity;
    for (const site of websites) {
        const prio = storePriority.get(site.category);
        if (typeof prio === 'number' && prio < bestPriority) {
            bestPriority = prio;
            bestLink = site.url;
        }
    }
    
    if (bestPriority === 1 && bestLink) {
        try {
            const url = new URL(bestLink);
            url.searchParams.set('l', 'german');
            return url.toString();
        } catch (e) { return bestLink; }
    }
    return bestLink;
}

// ===================================
// EXTERNE DIENSTE
// ===================================
function loadGoogleAnalytics() {
    const MID = 'G-9MTCLGZVDD';
    if (window.gtag) return;
    const s1 = document.createElement('script');
    s1.async = true;
    s1.src = `https://www.googletagmanager.com/gtag/js?id=${MID}`;
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
        theme:    'classic',
        position: 'bottom',
        type:     'opt-in',
        revokable:false,
        content: {
            message: "Wir würden gerne Cookies für Analyse-Zwecke verwenden.",
            allow:  'Akzeptieren',
            deny:   'Ablehnen',
            link:   'Mehr erfahren',
            href:   '/datenschutz.html'
        },
        onStatusChange() {
            if (this.hasConsented()) loadGoogleAnalytics();
        }
    });
});