const fetch = require('node-fetch');

exports.handler = async function (event, context) {
    const clientId = process.env.VITE_CLIENT_ID;
    const clientSecret = process.env.VITE_CLIENT_SECRET;
    const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;

    try {
        // 1. Authentifizierungs-Token von Twitch holen
        const authResponse = await fetch(tokenUrl, { method: 'POST' });
        const authData = await authResponse.json();
        const accessToken = authData.access_token;

        if (!accessToken) {
            return { statusCode: 401, body: 'Fehler bei der Authentifizierung' };
        }

        // 2. Eigentliche Anfrage an die IGDB-API stellen
        const igdbResponse = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'text/plain'
            },
            body: event.body // Leitet den Body von unserer Webseite weiter
        });

        const gamesData = await igdbResponse.json();
        
        return {
            statusCode: 200,
            body: JSON.stringify(gamesData)
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};