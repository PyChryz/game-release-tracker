// Globale Variablen für den Zustand der Seite
let gameOffset = 0;
const gamesPerLoad = 20;
let currentView = 'upcoming'; // Mögliche Werte: 'upcoming' oder 'search'
let currentSearchQuery = '';
let debounceTimer;

// Hauptfunktion, die nach dem Laden der Seite ausgeführt wird
document.addEventListener('DOMContentLoaded', () => {
    // Referenzen zu den HTML-Elementen
    const loadMoreButton = document.getElementById('load-more-btn');
    const searchInput = document.getElementById('search-input');
    const gamesContainer = document.getElementById('games-container');
    const mainTitle = document.getElementById('main-title');
    const searchForm = document.getElementById('search-form');

    // Verhindert das Neuladen der Seite bei Enter-Druck im Suchfeld
    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
    });

    // 1. Initiale Liste der kommenden Spiele laden
    fetchUpcomingGames(gameOffset);

    // 2. Listener für die Live-Suche
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
                gamesContainer.innerHTML = '';
                gameOffset = 0;
                currentView = 'upcoming';
                document.getElementById('load-more-btn').style.display = 'inline-block';
                fetchUpcomingGames(gameOffset);
            }
        }, 400);
    });

    // 3. Listener für den Klick auf den Titel (Zurücksetzen)
    mainTitle.addEventListener('click', () => {
        if (currentView !== 'upcoming') {
            searchInput.value = '';
            gamesContainer.innerHTML = '';
            gameOffset = 0;
            currentView = 'upcoming';
            document.getElementById('load-more-btn').style.display = 'inline-block';
            fetchUpcomingGames(gameOffset);
        }
    });

    // 4. Listener für den "Mehr laden"-Button
    loadMoreButton.addEventListener('click', () => {
        gameOffset += gamesPerLoad;

        if (currentView === 'upcoming') {
            fetchUpcomingGames(gameOffset);
        } else if (currentView === 'search') {
            fetchSearchResults(currentSearchQuery, gameOffset);
        }
    });
});

// Funktion, um kommende Spiele zu holen
function fetchUpcomingGames(offset) {
    const apiUrl = '/api/igdb';
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const body = `
        fields name, cover.url, first_release_date, websites.*, platforms.name;
        where first_release_date > ${currentTimestamp} & cover.url != null;
        sort first_release_date asc;
        limit ${gamesPerLoad};
        offset ${offset};
    `;

    fetch(apiUrl, { method: 'POST', body: body })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            return response.json();
        })
        .then(games => {
            displayGames(games);
            if (games.length < gamesPerLoad) document.getElementById('load-more-btn').style.display = 'none';
        })
        .catch(error => {
            console.error('Fehler bei fetchUpcomingGames:', error);
            document.getElementById('games-container').innerHTML = `<p class="info-text">Spiele konnten nicht geladen werden.</p>`;
        });
}

// Funktion, um Suchergebnisse zu holen 
function fetchSearchResults(query, offset) {
    const apiUrl = '/api/igdb';
    const gamesContainer = document.getElementById('games-container');
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const body = `
        fields name, cover.url, first_release_date, websites.*, platforms.name;
        where name ~ *"${query}"* & first_release_date > ${currentTimestamp} & cover.url != null;
        limit ${gamesPerLoad};
        offset ${offset};
    `;

    fetch(apiUrl, { method: 'POST', body: body })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP-Fehler! Status: ${response.status}`);
            return response.json();
        })
        .then(games => {
            if (games.length === 0 && offset === 0) {
                gamesContainer.innerHTML = `<p class="info-text">Keine kommenden Spiele für "${query}" gefunden.</p>`;
                document.getElementById('load-more-btn').style.display = 'none';
                return;
            }
            displayGames(games);
            if (games.length < gamesPerLoad) {
                document.getElementById('load-more-btn').style.display = 'none';
            } else {
                document.getElementById('load-more-btn').style.display = 'inline-block';
            }
        })
        .catch(error => {
            console.error('Fehler bei der Spielsuche:', error);
            gamesContainer.innerHTML = `<p class="info-text">Ein Fehler ist aufgetreten. Bitte versuche es später erneut.</p>`;
        });
}

// Funktion, um die Spiele-Karten zu erstellen und anzuzeigen
function displayGames(games) {
    const container = document.getElementById('games-container');

    games.forEach(game => {
        if (!game.cover || !game.cover.url) return;

        let platformIcons = '';
        if (game.platforms) {
            const platformNames = game.platforms.map(p => p.name);
            const uniquePlatforms = new Set();
            if (platformNames.includes('PC (Microsoft Windows)')) uniquePlatforms.add('<i class="fa-brands fa-windows"></i>');
            if (platformNames.some(p => p.includes('PlayStation'))) uniquePlatforms.add('<i class="fa-brands fa-playstation"></i>');
            if (platformNames.some(p => p.includes('Xbox'))) uniquePlatforms.add('<i class="fa-brands fa-xbox"></i>');
            if (platformNames.some(p => p.includes('Nintendo'))) uniquePlatforms.add('<i class="fa-brands fa-nintendo-switch"></i>');

            platformIcons = [...uniquePlatforms].join(' ');
        }

        const coverUrl = game.cover.url.replace('t_thumb', 't_cover_big');
        const releaseDate = game.first_release_date ? new Date(game.first_release_date * 1000) : null;
        const storeLink = getStoreLink(game.websites);

        const imageElement = storeLink
            ? `<a href="${storeLink}" target="_blank" rel="noopener noreferrer"><img src="${coverUrl}" alt="Cover von ${game.name}" class="game-image"></a>`
            : `<img src="${coverUrl}" alt="Cover von ${game.name}" class="game-image">`;

        const gameCard = document.createElement('div');
        gameCard.classList.add('game-card');
        gameCard.innerHTML = `
            ${imageElement} 
            <div class="card-content">
                <div class="card-header">
                    <h2 class="game-title">${game.name}</h2>
                    <div class="platform-icons">${platformIcons}</div>
                </div>
                <p class="release-date">${releaseDate ? 'Erscheint am: ' + releaseDate.toLocaleDateString('de-DE') : 'Datum unbekannt'}</p>
                <div class="countdown-timer" id="timer-${game.id}"></div>
            </div>
        `;
        container.appendChild(gameCard);

        if (releaseDate && releaseDate > new Date()) {
            startCountdown(`timer-${game.id}`, game.first_release_date);
        }
    });
}

// Hilfsfunktion, um den besten Store-Link auszuwählen
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

// Funktion für den Countdown-Timer
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