// Globale Variablen
let gameOffset = 0;
const gamesPerLoad = 20;
let currentView = 'upcoming';
let currentSearchQuery = '';
let debounceTimer;

// --- DOM-Elemente einmalig holen ---
const loadMoreButton = document.getElementById('load-more-btn');
const searchInput = document.getElementById('search-input');
const gamesContainer = document.getElementById('games-container');
const mainTitle = document.getElementById('main-title');
const searchForm = document.getElementById('search-form');

// --- HILFSFUNKTIONEN ---

// Setzt die Ansicht auf die Startseite zurück
function resetToUpcomingView() {
    searchInput.value = '';
    gameOffset = 0;
    currentView = 'upcoming';
    loadMoreButton.style.display = 'inline-block';
    fetchUpcomingGames(gameOffset);
}

// Allgemeine Funktion zum Abrufen von Spieldaten
function fetchGames(body, isSearch = false, query = '') {
    const apiUrl = '/api/igdb';
    const loader = document.getElementById('loader');

    // Loader anzeigen und Container leeren, wenn es eine neue Suche/Ansicht ist
    if (gameOffset === 0) {
        gamesContainer.innerHTML = '';
        loader.style.display = 'block';
    }

    // "Mehr laden"-Button während des Ladens ausblenden
    loadMoreButton.style.display = 'none';

    fetch(apiUrl, { method: 'POST', body: body })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            return response.json();
        })
        .then(games => {
            loader.style.display = 'none'; // Loader immer ausblenden, wenn die Antwort da ist

            if (isSearch && games.length === 0 && gameOffset === 0) {
                gamesContainer.innerHTML = `<p class="info-text">Keine kommenden Spiele für "${query}" gefunden.</p>`;
                return; // Wichtig: Funktion hier beenden
            }

            displayGames(games);

            // Button nur anzeigen, wenn es potenziell mehr Ergebnisse gibt
            if (games.length < gamesPerLoad) {
                loadMoreButton.style.display = 'none';
            } else {
                loadMoreButton.style.display = 'inline-block';
            }
        })
        .catch(error => {
            console.error('Fehler bei der API-Anfrage:', error);
            loader.style.display = 'none'; // Loader auch bei Fehler ausblenden
            gamesContainer.innerHTML = `<p class="info-text">Ein Fehler ist aufgetreten.</p>`;
        });
}

// --- SPEZIFISCHE FETCH-FUNKTIONEN ---

function fetchUpcomingGames(offset) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const body = `
        fields name, cover.url, first_release_date, websites.*, platforms.name, release_dates.*;
        where first_release_date > ${currentTimestamp} & cover.url != null;
        sort first_release_date asc;
        limit ${gamesPerLoad};
        offset ${offset};
    `;
    fetchGames(body);
}

function fetchSearchResults(query, offset) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const body = `
        fields name, cover.url, first_release_date, websites.*, platforms.name, release_dates.*;
        where name ~ *"${query}"* & first_release_date > ${currentTimestamp} & cover.url != null;
        limit ${gamesPerLoad};
        offset ${offset};
    `;
    fetchGames(body, true, query);
}

// --- HAUPTLOGIK & EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    searchForm.addEventListener('submit', (event) => event.preventDefault());

    mainTitle.addEventListener('click', () => {
        if (currentView !== 'upcoming') {
            resetToUpcomingView();
        }
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();

        debounceTimer = setTimeout(() => {
            if (query) {
                gamesContainer.innerHTML = '';
                gameOffset = 0;
                currentView = 'search';
                currentSearchQuery = query;
                fetchSearchResults(query, gameOffset);
            } else {
                // Nur zurücksetzen, wenn die vorherige Ansicht eine Suche war
                if (currentView === 'search') {
                    resetToUpcomingView();
                }
            }
        }, 400);
    });

    loadMoreButton.addEventListener('click', () => {
        gameOffset += gamesPerLoad;
        if (currentView === 'upcoming') {
            fetchUpcomingGames(gameOffset);
        } else if (currentView === 'search') {
            fetchSearchResults(currentSearchQuery, gameOffset);
        }
    });

    // Initiale Liste laden
    fetchUpcomingGames(gameOffset);
});


// --- DARSTELLUNGS-FUNKTIONEN ---

function getBestReleaseTimestamp(releaseDates, fallbackTimestamp) {
    if (!releaseDates || releaseDates.length === 0) {
        return fallbackTimestamp;
    }

    // Regionen-ID für Europa ist 2
    const europeRelease = releaseDates.find(date => date.region === 2);

    if (europeRelease && europeRelease.date) {
        return europeRelease.date; // Gib den europäischen Timestamp zurück
    }

    // Wenn kein EU-Datum gefunden, nimm das erste verfügbare Datum
    if (releaseDates[0] && releaseDates[0].date) {
        return releaseDates[0].date;
    }

    // Wenn alles fehlschlägt, nimm das allgemeine Datum
    return fallbackTimestamp;
}


function displayGames(games) {
    const container = document.getElementById('games-container');

    games.forEach(game => {
        const placeholderImageUrl = 'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" width="280" height="200" viewBox="0 0 280 200"%3e%3crect fill="%232a2a2a" width="100%" height="100%"/%3e%3ctext fill="%23666" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" font-family="sans-serif"%3eKein Cover%3c/text%3e%3c/svg%3e';
        const coverUrl = game.cover ? game.cover.url.replace('t_thumb', 't_cover_big') : placeholderImageUrl;


        let platformIcons = '';
        if (game.platforms) {
            const platformNames = game.platforms.map(p => p.name);
            const uniquePlatforms = new Set();
            if (platformNames.includes('PC (Microsoft Windows)')) uniquePlatforms.add('<i class="fa-brands fa-windows"></i>');
            if (platformNames.some(p => p.includes('PlayStation'))) uniquePlatforms.add('<i class="fa-brands fa-playstation"></i>');
            if (platformNames.some(p => p.includes('Xbox'))) uniquePlatforms.add('<i class="fa-brands fa-xbox"></i>');
            if (platformNames.some(p => p.includes('Nintendo') || p.includes('Switch'))) {
                uniquePlatforms.add('<i class="fas fa-gamepad"></i>');
            }
            platformIcons = [...uniquePlatforms].join(' ');
        }

        const bestTimestamp = getBestReleaseTimestamp(game.release_dates, game.first_release_date);
        const releaseDate = bestTimestamp ? new Date(bestTimestamp * 1000) : null;

        const storeLink = getStoreLink(game.websites);

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
                <p class="release-date">${releaseDate ? 'Erscheint am: ' + releaseDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr' : 'Datum unbekannt'}</p>
                <div class="countdown-timer" id="timer-${game.id}"></div>
            </div>
        `;
        container.appendChild(gameCard);

        if (releaseDate && releaseDate > new Date()) {
            // Wir übergeben den besten Timestamp an den Countdown
            startCountdown(`timer-${game.id}`, bestTimestamp);
        }
    });
}

function getStoreLink(websites) {
    if (!websites) return null;
    const storePriority = { 13: 1, 16: 2, 17: 3, 1: 4 };
    let bestLink = null;
    let lowestPriority = Infinity;
    websites.forEach(site => {
        const priority = storePriority[site.category];
        if (priority && priority < lowestPriority) {
            lowestPriority = priority;
            bestLink = site.url;
        }
    });
    return bestLink;
}

function startCountdown(elementId, releaseTimestamp) {
    const timerElement = document.getElementById(elementId);
    if (!timerElement) return;

    const releaseDate = releaseTimestamp * 1000;
    const timerInterval = setInterval(() => {
        const jetzt = new Date().getTime();
        const abstand = releaseDate - jetzt;

        if (abstand < 0) {
            clearInterval(timerInterval);
            timerElement.innerHTML = "🎉 Veröffentlicht!";
            return;
        }
        const tage = Math.floor(abstand / (1000 * 60 * 60 * 24));
        const stunden = Math.floor((abstand % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minuten = Math.floor((abstand % (1000 * 60 * 60)) / (1000 * 60));
        const sekunden = Math.floor((abstand % (1000 * 60)) / 1000);
        timerElement.innerHTML = `${tage}T ${stunden}h ${minuten}m ${sekunden}s`;
    }, 1000);
}

// --- COOKIE CONSENT INITIALISIERUNG ---

// Diese leere Funktion füllen wir im nächsten Schritt mit dem Google Analytics Code.
function loadGoogleAnalytics() {
    console.log("Nutzer hat zugestimmt. Lade Google Analytics...");
    const measurementId = 'G-9MTCLGZVDD'; // Deine korrekte ID

    if (window.gtag) {
        console.log("Google Analytics wurde bereits geladen.");
        return;
    }

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

window.addEventListener("load", function(){
    window.cookieconsent.initialise({
      "palette": {
        "popup": { "background": "#2a2a2a", "text": "#f0f0f0" },
        "button": { "background": "#9146ff" }
      },
      "theme": "classic",
      "position": "bottom",
      "revokable": false,
      "type": "opt-in",
      "content": {
        "message": "Wir würden gerne Cookies für Analyse-Zwecke verwenden, um die Webseite zu verbessern. Stimmst du dem zu?",
        "allow": "Akzeptieren",
        "deny": "Ablehnen",
        "link": "Mehr erfahren",
        "href": "/datenschutz.html"
      },
      // --- KORRIGIERTER TEIL ---
      // Diese Funktion wird jedes Mal ausgeführt, wenn sich der Status ändert ODER
      // beim Seitenaufruf, wenn bereits eine Zustimmung vorliegt.
      onStatusChange: function(status) {
        if (this.hasConsented()) {
          loadGoogleAnalytics();
        }
      }
    })
});