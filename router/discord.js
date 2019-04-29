'use strict';

const express = require('express');

const qs = require('querystring');

const request = require('request-promise-native');

const router = express.Router();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8080/connect/callback';

router.get('/login', (req, res) => {
    res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=connections%20guilds%20email%20identify`);
});

router.get('/callback', async (req, res) => {
    if (!req.query.code) {
        res.status(400).send({status: 'ERROR', error: 'Not authenticated properly, please retry.' });
        return;
    }

    const code = req.query.code;

    const data = {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'scope': 'identify email connections guilds'
    };

    const formData = qs.stringify(data);

    const options = {
        url: `https://discordapp.com/api/oauth2/token`,
        method: 'POST',
        headers: {
            'Content-Length': formData.length,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData,
        json: true
    };

    try {
        const response = await request(options);
        res.redirect(`/?token=${response.access_token}&refresh=${response.refresh_token}`);
    } catch(e) {
        res.redirect('/invalidToken');
    }

});

router.get('/logout', (req, res) => {
    if (req.session.userID) {
        req.session.destroy();
        res.redirect('/logoutSuccess');
    } else {
        res.redirect('/');
    }
});

module.exports = router;