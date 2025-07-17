// ===================================
// GLOBALE VARIABLEN & KONSTANTEN
// ===================================
let gameOffset = 0;
const gamesPerLoad = 20;
let currentView = 'upcoming';
let currentSearchQuery = '';
let debounceTimer;
const countdownElements = [];
let countdownStarted = false;
let activePlatformFilters = new Set();

// Konstanten für Regionen und Stores
const REGION_EUROPE = 2;
const STORE_STEAM = 13;
const STORE_EPIC = 16;
const STORE_GOG = 17;
const STORE_OFFICIAL = 1;

// Konstanten für Plattform-Icons
const platformIconMap = {
    6: '<i class="fa-brands fa-windows"></i>',       // PC
    169: '<i class="fa-brands fa-xbox"></i>',         // Xbox Series X|S
    49: '<i class="fa-brands fa-xbox"></i>',          // Xbox One
    167: '<i class="fa-brands fa-playstation"></i>', // PlayStation 5
    48: '<i class="fa-brands fa-playstation"></i>',  // PlayStation 4
    130: '<i class="fas fa-gamepad"></i>'             // Nintendo Switch
};


// ===================================
// DOM-ELEMENTE
// ===================================
const loadMoreButton = document.getElementById('load-more-btn');
const searchInput = document.getElementById('search-input');
const gamesContainer = document.getElementById('games-container');
const mainTitle = document.getElementById('main-title');
const searchForm = document.getElementById('search-form');
const toggleButton = document.getElementById('theme-toggle');
const platformFilterContainer = document.getElementById('platform-filter');
const loader = document.getElementById('loader');

// ===================================
// HAUPTLOGIK & EVENT LISTENERS
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // Referenzen zu den DOM-Elementen holen
    const siteLogo = document.getElementById('site-logo-img'); 
    const lightLogoSrc = './icon/logo.png'; // Pfad zum hellen Logo
    const darkLogoSrc = './icon/logo.png'; // Pfad zum dunklen Logo

    // Theme-Toggle
    toggleButton?.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');

        // Logo-Quelle basierend auf dem Theme ändern
        if (document.body.classList.contains('light-mode')) {
            siteLogo.src = darkLogoSrc;
        } else {
            siteLogo.src = lightLogoSrc;
        }
    });

    // Enter-Taste im Suchfeld abfangen
    searchForm.addEventListener('submit', (event) => event.preventDefault());

    // Titel-Klick zum Zurücksetzen
    mainTitle.addEventListener('click', () => {
        if (currentView !== 'upcoming') {
            resetToUpcomingView();
        }
    });

    // Live-Suche
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();

        debounceTimer = setTimeout(() => {
            gameOffset = 0;
            if (query) {
                currentView = 'search';
                currentSearchQuery = query;
                fetchSearchResults(query, gameOffset, activePlatformFilters);
            } else if (currentView === 'search') {
                resetToUpcomingView();
            }
        }, 400);
    });

    // "Mehr laden"-Button
    loadMoreButton.addEventListener('click', () => {
        gameOffset += gamesPerLoad;
        if (currentView === 'upcoming') {
            fetchUpcomingGames(gameOffset, activePlatformFilters);
        } else if (currentView === 'search') {
            fetchSearchResults(currentSearchQuery, gameOffset, activePlatformFilters);
        }
    });

    // Plattform-Filter
    platformFilterContainer?.addEventListener('change', () => {
        activePlatformFilters.clear();
        const checkboxes = platformFilterContainer.querySelectorAll('input[type=checkbox]:checked');
        checkboxes.forEach(cb => {
            activePlatformFilters.add(parseInt(cb.value));
        });

        gameOffset = 0;
        if (currentView === 'search' && currentSearchQuery) {
            fetchSearchResults(currentSearchQuery, gameOffset, activePlatformFilters);
        } else {
            fetchUpcomingGames(gameOffset, activePlatformFilters);
        }
    });

    // Initiale Liste laden
    fetchUpcomingGames(gameOffset, activePlatformFilters);
});

// ===================================
// API-FUNKTIONEN
// ===================================
function fetchGames(body, isSearch = false, query = '') {
    const apiUrl = '/api/igdb';

    if (gameOffset === 0) {
        gamesContainer.innerHTML = '';
        loader.style.display = 'block';
    }
    loadMoreButton.style.display = 'none';

    fetch(apiUrl, { method: 'POST', body: body })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            return response.json();
        })
        .then(games => {
            loader.style.display = 'none';

            if (isSearch && games.length === 0 && gameOffset === 0) {
                gamesContainer.innerHTML = `<p class="info-text">Keine kommenden Spiele für "${query}" gefunden.</p>`;
                return;
            }
            displayGames(games);

            if (games.length < gamesPerLoad) {
                loadMoreButton.style.display = 'none';
            } else {
                loadMoreButton.style.display = 'inline-block';
            }
        })
        .catch(error => {
            console.error('Fehler bei der API-Anfrage:', error);
            loader.style.display = 'none';
            gamesContainer.innerHTML = `<p class="info-text">Ein Fehler ist aufgetreten.</p>`;
        });
}

function fetchUpcomingGames(offset, platformIds = new Set()) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    let whereClause = `first_release_date > ${currentTimestamp}`;
    if (platformIds.size > 0) {
        whereClause += ` & platforms = (${[...platformIds].join(',')})`;
    }
    const body = `
        fields name, cover.url, first_release_date, websites.*, platforms.id, platforms.name, release_dates.*;
        where ${whereClause};
        sort first_release_date asc;
        limit ${gamesPerLoad};
        offset ${offset};
    `;
    fetchGames(body);
}

function fetchSearchResults(query, offset, platformIds = new Set()) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    let whereClause = `name ~ *"${query}"* & first_release_date > ${currentTimestamp}`;
    if (platformIds.size > 0) {
        whereClause += ` & platforms = (${[...platformIds].join(',')})`;
    }
    const body = `
        fields name, cover.url, first_release_date, websites.*, platforms.id, platforms.name, release_dates.*;
        where ${whereClause};
        limit ${gamesPerLoad};
        offset ${offset};
    `;
    fetchGames(body, true, query);
}

// ===================================
// DARSTELLUNGS-FUNKTIONEN
// ===================================
function displayGames(games) {
    // Bei einer neuen Anzeige (erste Seite), das Countdown-Array leeren
    if (gameOffset === 0) {
        countdownElements.length = 0;
    }

    games.forEach(game => {
        const placeholderImageUrl = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" width="280" height="200" viewBox="0 0 280 200"%3e%3crect fill="%232a2a2a" width="100%" height="100%"/%3e%3ctext fill="%23666" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" font-family="sans-serif"%3eKein Cover%3c/text%3e%3c/svg%3e';
        const coverUrl = game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : placeholderImageUrl;

        const uniquePlatforms = new Set();
        if (game.platforms) {
            game.platforms.forEach(p => {
                if (platformIconMap[p.id]) {
                    uniquePlatforms.add(platformIconMap[p.id]);
                }
            });
        }
        const platformIcons = [...uniquePlatforms].join(' ');

        const bestTimestamp = getBestReleaseTimestamp(game.release_dates, game.first_release_date);
        const releaseDate = bestTimestamp ? new Date(bestTimestamp * 1000) : null;
        
        let releaseDateString = 'Datum unbekannt';
        if (releaseDate) {
            if (isMidnightUTC(releaseDate)) {
                releaseDateString = `Erscheint am: ${releaseDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
            } else {
                releaseDateString = `Erscheint am: ${releaseDate.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr`;
            }
        }

        const storeLink = getStoreLink(game.websites, activePlatformFilters);
        const imageContainerTag = storeLink ? 'a' : 'div';
        const imageElement = `
            <${imageContainerTag} 
                ${storeLink ? `href="${storeLink}"` : ''} 
                class="game-image-container" 
                style="background-image: url(${coverUrl})" 
                target="_blank" 
                rel="noopener noreferrer"
            >
                <img src="${coverUrl}" alt="Cover von ${game.name}" class="game-image" loading="lazy">
            </${imageContainerTag}>
        `;

        const gameCard = document.createElement('div');
        gameCard.classList.add('game-card');
        gameCard.innerHTML = `
            ${imageElement} 
            <div class="card-content">
                <div class="card-header">
                    <h2 class="game-title">${game.name}</h2>
                    <div class="platform-icons">${platformIcons}</div>
                </div>
                <p class="release-date">${releaseDateString}</p>
                <div class="countdown-timer" id="timer-${game.id}"></div>
            </div>
        `;
        gamesContainer.appendChild(gameCard);

        if (releaseDate && releaseDate > new Date()) {
            countdownElements.push({ elementId: `timer-${game.id}`, timestamp: bestTimestamp });
        }
    });

    if (!countdownStarted) {
        startGlobalCountdown();
        countdownStarted = true;
    }
}

function startGlobalCountdown() {
    setInterval(() => {
        const now = Date.now();
        // Wir iterieren rückwärts, um Elemente sicher entfernen zu können
        for (let i = countdownElements.length - 1; i >= 0; i--) {
            const { elementId, timestamp } = countdownElements[i];
            const el = document.getElementById(elementId);

            if (!el) {
                // Element ist nicht mehr im DOM, entferne es aus dem Array
                countdownElements.splice(i, 1);
                continue;
            }

            const diff = timestamp * 1000 - now;
            if (diff < 0) {
                el.innerHTML = "🎉 Veröffentlicht!";
                continue; // Nächstes Element in der Schleife
            }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            el.innerHTML = `${d}T ${h}h ${m}m ${s}s`;
        }
    }, 1000);
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

function getBestReleaseTimestamp(releaseDates, fallbackTimestamp) {
    if (!releaseDates || releaseDates.length === 0) return fallbackTimestamp;
    const euRelease = releaseDates.find(d => d.region === REGION_EUROPE);
    return euRelease?.date || releaseDates[0]?.date || fallbackTimestamp;
}

function isMidnightUTC(date) {
    return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
}

function getStoreLink(websites, activeFilters) {
    if (!websites || websites.length === 0) return null;

    // Store-Kategorien von IGDB
    const STORE_OFFICIAL = 1;
    const STORE_STEAM = 13;
    const STORE_XBOX = 14;
    const STORE_PLAYSTATION = 15;
    const STORE_EPIC = 16;
    const STORE_GOG = 17;
    const STORE_NINTENDO = 18;


    // Helper-Funktion, die einen Link anhand der Store-Kategorie findet
    const findStoreLinkByCategory = (categoryId) => {
        const site = websites.find(s => s.category === categoryId);
        return site ? site.url : null;
    };

    // Wenn Filter aktiv sind, suche gezielt nach dem passenden Store
    if (activeFilters.size > 0) {
        // Prüfe auf PlayStation
        if (activeFilters.has(167) || activeFilters.has(48)) {
            const psLink = findStoreLinkByCategory(STORE_PLAYSTATION);
            if (psLink) return psLink; // Store leitet selbst auf /de-de weiter
        }
        // ✅ Prüfe auf Xbox (jetzt mit korrekter Kategorie-ID)
        if (activeFilters.has(169) || activeFilters.has(49)) {
            const xboxLink = findStoreLinkByCategory(STORE_XBOX);
            if (xboxLink) return xboxLink; // Store leitet selbst auf /de-DE weiter
        }
        // Prüfe auf Nintendo
        if (activeFilters.has(130)) {
            const nintendoLink = findStoreLinkByCategory(STORE_NINTENDO);
            if (nintendoLink) return nintendoLink; // Store leitet selbst weiter
        }
        // Prüfe auf PC
        if (activeFilters.has(6)) {
            const steamLink = findStoreLinkByCategory(STORE_STEAM);
            if (steamLink) {
                // Nur bei Steam fügen wir den Sprachparameter hinzu, da dies zuverlässig funktioniert
                const url = new URL(steamLink);
                url.searchParams.set('l', 'german');
                return url.toString();
            }
            const epicLink = findStoreLinkByCategory(STORE_EPIC);
            if (epicLink) return epicLink;

            const gogLink = findStoreLinkByCategory(STORE_GOG);
            if (gogLink) return gogLink;
        }
    }

    // FALLBACK-LOGIK: Wenn kein Filter aktiv ist, nimm den wichtigsten verfügbaren Link (Priorität: Steam)
    const steamUrl = findStoreLinkByCategory(STORE_STEAM);
    if (steamUrl) {
        const url = new URL(steamUrl);
        url.searchParams.set('l', 'german');
        return url.toString();
    }
    // Nimm den nächsten verfügbaren Link
    const fallbackUrls = [
        findStoreLinkByCategory(STORE_PLAYSTATION),
        findStoreLinkByCategory(STORE_XBOX),
        findStoreLinkByCategory(STORE_NINTENDO),
        findStoreLinkByCategory(STORE_EPIC),
        findStoreLinkByCategory(STORE_GOG),
        findStoreLinkByCategory(STORE_OFFICIAL)
    ];
    
    // Gib den ersten gültigen Link aus der Fallback-Liste zurück
    return fallbackUrls.find(url => url !== null) || null;
}

// ===================================
// EXTERNE DIENSTE
// ===================================
function loadGoogleAnalytics() {
    const measurementId = 'G-9MTCLGZVDD';
    if (window.gtag) return;
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script1);
    const script2 = document.createElement('script');
    script2.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${measurementId}');
    `;
    document.head.appendChild(script2);
}

window.addEventListener("load", function () {
    window.cookieconsent.initialise({
        "palette": {
            "popup": { "background": "#2a2a2a", "text": "#f0f0f0" },
            "button": { "background": "#9146ff" }
        },
        "theme": "classic",
        "position": "bottom",
        "type": "opt-in",
        "revokable": false,
        "content": {
            "message": "Wir würden gerne Cookies für Analyse-Zwecke verwenden, um die Webseite zu verbessern. Stimmst du dem zu?",
            "allow": "Akzeptieren",
            "deny": "Ablehnen",
            "link": "Mehr erfahren",
            "href": "/datenschutz.html"
        },
        onStatusChange: function (status) {
            if (this.hasConsented()) {
                loadGoogleAnalytics();
            }
        }
    });
});