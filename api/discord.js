'use strict';

const express = require('express');

const request = require('request-promise-native');
const btoa = require('btoa');

const router = express.Router();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const redirect = encodeURIComponent('http://localhost:8080/connect/callback');

router.get('/login', (req, res) => {
    res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=connections%20guilds%20email%20identify`);
});

router.get('/callback', async (req, res, next) => {
    if (!req.query.code) {
        res.status(400).send({status: 'ERROR', error: 'Not authenticated properly, please retry' });
        return;
    }
    const code = req.query.code;
    const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

    const options = {
        url: `https://discordapp.com/api/oauth2/token?grant_type=authorization_code&code=${code}&redirect_uri=${redirect}`,
        method: 'POST',
        headers: {
            Authorization: `Basic ${creds}`
        },
        json: true
    };

    try {
        const response = await request(options);
        res.redirect(`/?token=${response.access_token}&refresh=${response.refresh_token}`);
    } catch(e) {
        res.redirect('/invalidToken');
    }

});

module.exports = router;