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

const REGION_EUROPPE = 2;
const STORE_STEAM = 13;
const STORE_EPIC  = 16;
const STORE_GOG   = 17;
const STORE_OFFICIAL = 1;

// Prioritäten für Fallback
const storePriority = new Map([
  [STORE_STEAM,     1],
  [STORE_EPIC,      2],
  [STORE_GOG,       3],
  [STORE_OFFICIAL,  4]
]);

// Icon-Mapping für Plattformen
const platformIconMap = {
  6:   '<i class="fa-brands fa-windows"></i>',
  49:  '<i class="fa-brands fa-xbox"></i>',
  169: '<i class="fa-brands fa-xbox"></i>',
  48:  '<i class="fa-brands fa-playstation"></i>',
  167: '<i class="fa-brands fa-playstation"></i>',
  130: '<i class="fas fa-gamepad"></i>'
};

// Einheitliches Store-Mapping
const platformStoreRules = new Map([
  [6,   { categories: [STORE_STEAM, STORE_EPIC, STORE_GOG], domains: [] }],
  [48,  { categories: [], domains: ['store.playstation.com'] }],
  [167, { categories: [], domains: ['store.playstation.com'] }],
  [49,  { categories: [], domains: ['xbox.com', 'microsoft.com'] }],
  [169, { categories: [], domains: ['xbox.com', 'microsoft.com'] }],
  [130, { categories: [], domains: ['nintendo.com'] }]
]);

const localeTransformMap = new Map([
  // Steam: ?l=german
  [STORE_STEAM, urlStr => {
    const url = new URL(urlStr);
    url.searchParams.set('l', 'german');
    return url.toString();
  }],
  // PlayStation Store: …/de-DE/…
  ['store.playstation.com', urlStr =>
    urlStr.replace(
      'store.playstation.com/',
      'store.playstation.com/de-DE/'
    )
  ],
  // Xbox/Microsoft: ?market=de-DE
  ['xbox.com', urlStr => {
    const url = new URL(urlStr);
    url.searchParams.set('market', 'de-DE');
    return url.toString();
  }],
  // Nintendo eShop: ?lang=de
  ['nintendo.com', urlStr => {
    const url = new URL(urlStr);
    url.searchParams.set('lang', 'de');
    return url.toString();
  }]
]);

// ===================================
// DOM-ELEMENTE
// ===================================
const loadMoreButton = document.getElementById('load-more-btn');
const searchInput    = document.getElementById('search-input');
const gamesContainer = document.getElementById('games-container');
const mainTitle      = document.getElementById('main-title');
const searchForm     = document.getElementById('search-form');
const toggleButton   = document.getElementById('theme-toggle');
const platformFilterContainer = document.getElementById('platform-filter');
const loader         = document.getElementById('loader');

// ===================================
// UTILS
// ===================================
/**
 * Debounce-Funktion
 */
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
  const siteLogo    = document.getElementById('site-logo-img');
  const lightLogo   = './icon/logo.png';
  const darkLogo    = './icon/logo.png';

  toggleButton?.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    if (siteLogo) {
      siteLogo.src = document.body.classList.contains('light-mode')
        ? darkLogo
        : lightLogo;
    }
  });

  searchForm.addEventListener('submit', e => e.preventDefault());

  mainTitle.addEventListener('click', () => {
    if (currentView !== 'upcoming') resetToUpcomingView();
  });

  searchInput.addEventListener(
    'input',
    debounce(() => {
      const q = searchInput.value.trim();
      gameOffset = 0;
      if (q) {
        currentView = 'search';
        currentSearchQuery = q;
        fetchSearchResults(q, gameOffset, activePlatformFilters);
      } else if (currentView === 'search') {
        resetToUpcomingView();
      }
    }, 400)
  );

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
  if (gameOffset === 0) {
    gamesContainer.innerHTML = '';
    loader && (loader.style.display = 'block');
  }
  loadMoreButton && (loadMoreButton.style.display = 'none');

  fetch('/api/igdb', {
    method: 'POST',
    body
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`);
      return res.json();
    })
    .then(games => {
      loader && (loader.style.display = 'none');
      if (isSearch && games.length === 0 && gameOffset === 0) {
        gamesContainer.innerHTML = `<p class="info-text">Keine Spiele für „${query}“ gefunden.</p>`;
        return;
      }
      displayGames(games);
      loadMoreButton.style.display =
        games.length < gamesPerLoad ? 'none' : 'inline-block';
    })
    .catch(err => {
      console.error('API-Fehler:', err);
      loader && (loader.style.display = 'none');
      gamesContainer.innerHTML = `<p class="info-text">Ein Fehler ist aufgetreten.</p>`;
    });
}

function fetchUpcomingGames(offset, platformIds = new Set()) {
  const nowUnix = Math.floor(Date.now() / 1000);
  let where = `first_release_date > ${nowUnix}`;
  if (platformIds.size) {
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
  if (platformIds.size) {
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
  if (gameOffset === 0) {
    countdownElements.length = 0;
    if (countdownIntervalId !== null) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  }

  const fragment = document.createDocumentFragment();

  games.forEach(game => {
    
    const placeholderSVG = 
      'data:image/svg+xml;charset=UTF-8,' +
      '%3csvg xmlns="http://www.w3.org/2000/svg" width="280" height="200" viewBox="0 0 280 200"%3e' +
      '%3crect fill="%232a2a2a" width="100%" height="100%"/%3e' +
      '%3ctext fill="%23666" x="50%" y="50%" dominant-baseline="middle" ' +
      'text-anchor="middle" font-size="16" font-family="sans-serif"%3eKein Cover%3c/text%3e%3c/svg%3e';
    const coverUrl = game.cover
      ? game.cover.url.replace('t_thumb', 't_cover_big')
      : placeholderSVG;

    // Plattform-Icons
    const unique = new Set();
    (game.platforms || []).forEach(p => {
      if (platformIconMap[p.id]) unique.add(platformIconMap[p.id]);
    });
    const platformIcons = [...unique].join(' ');

    // Release-Datum
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

    // Store-Link
    const storeLink = getStoreLink(game.websites, activePlatformFilters);
    const wrapperTag = storeLink ? 'a' : 'div';
    const wrapperAttrs = storeLink
      ? `href="${storeLink}" target="_blank" rel="noopener noreferrer"`
      : '';

    const card = document.createElement('div');
    card.classList.add('game-card');
    card.innerHTML = `
      <${wrapperTag}
        class="game-image-container"
        style="background-image:url(${coverUrl})"
        ${wrapperAttrs}
      >
        <img
          src="${coverUrl}"
          alt="Cover von ${game.name}"
          class="game-image"
          loading="lazy"
        />
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

  if (countdownIntervalId === null && countdownElements.length) {
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
  if (countdownElements.length === 0 && countdownIntervalId !== null) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
}

// ===================================
// HILFSFUNKTIONEN
// ===================================
function resetToUpcomingView() {
  searchInput.value = '';
  gameOffset = 0;
  currentView = 'upcoming';
  fetchUpcomingGames(gameOffset, activePlatformFilters);
}

function getBestReleaseTimestamp(releaseDates, fallback) {
  if (!Array.isArray(releaseDates) || !releaseDates.length) return fallback;
  const eu = releaseDates.find(d => d.region === REGION_EUROPPE);
  return eu?.date || releaseDates[0]?.date || fallback;
}

function isMidnightUTC(date) {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0
  );
}

/**
 * Ermittelt den besten Store-Link basierend auf Filtern oder Fallback.
 */
function getStoreLink(websites, activeFilters) {
  if (!Array.isArray(websites) || !websites.length) return null;

  const candidates = new Set();

  if (activeFilters.size) {
    for (const pid of activeFilters) {
      const rule = platformStoreRules.get(pid);
      if (!rule) continue;
      rule.domains.forEach(dom => {
        websites.forEach(site => {
          if (site.url.includes(dom)) candidates.add(site.url);
        });
      });
      rule.categories.forEach(cat => {
        websites.forEach(site => {
          if (site.category === cat) candidates.add(site.url);
        });
      });
    }
  }

  // nach Priorität sortieren
  const sorted = [...candidates].sort((a, b) => {
    const catA = websites.find(s => s.url === a)?.category;
    const catB = websites.find(s => s.url === b)?.category;
    return (storePriority.get(catA) ?? Infinity) - (storePriority.get(catB) ?? Infinity);
  });

  if (sorted.length) {
    let link = sorted[0];
    const cat = websites.find(s => s.url === link)?.category;
    if (cat === STORE_STEAM) {
      try {
        const u = new URL(link);
        u.searchParams.set('l', 'german');
        link = u.toString();
      } catch {}
    }
      let link = sorted.length ? sorted[0] : bestLink;
  if (link) {
    // 1. Kategorie-basiertes Transform (z.B. Steam)
    const siteObj = websites.find(s => s.url === link);
    const byCategory = localeTransformMap.get(siteObj?.category);
    if (byCategory) {
      return byCategory(link);
    }
    // 2. Domain-basiertes Fallback-Transform
    for (const [key, transformFn] of localeTransformMap) {
      if (typeof key === 'string' && link.includes(key)) {
        return transformFn(link);
      }
    }
  }
    return link;
  }

  // Fallback
  let bestLink = null, bestPrio = Infinity;
  websites.forEach(site => {
    const p = storePriority.get(site.category);
    if (typeof p === 'number' && p < bestPrio) {
      bestPrio = p;
      bestLink = site.url;
    }
  });
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
