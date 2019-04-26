// Copyright 2019 Nicholas Wong

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const session = require('express-session');
const express = require('express');

const path = require('path');
const fs = require('fs');

const genuuid = require('uuid/v4');

const request = require('request-promise-native');

var app = express();

const PORT = 8080;

const GAME_DEV_SERVER_ID = "489531295848726528";

app.engine('html', function(filePath, options, callback) {
    fs.readFile(filePath, function(err, content) {
        if (err) return callback(err);

        var rendered = content.toString();
        if (options.ifuser) {
            rendered = rendered
                .replace(/\[ifuser ([^\]]+)]/gim, "$1")
                .replace(/\[ifnuser [^\]]+]/gim, "")
                .replace(/{username}/gm, options.username)
                .replace(/{avatar}/gm, options.avatar);
        } else {
            rendered = rendered.replace(/\[ifnuser ([^\]]+)]/gim, "$1").replace(/\[ifuser [^\]]+]/gim, "");
        }
        return callback(null, rendered);
    });
});

app.set('views', './static');
app.set('view engine', 'html');

app.use(session({
    genid: function(req) {
        return genuuid()
    },
    secret: process.env.CLIENT_SECRET,
    access_token: "",
    refresh_tokne: "",
    cookie: {
        secure: false
    }
}));

app.get('/', async (req, res) => {
    if (req.query.token && req.query.refresh) {

        // Get user information
        let user = await request({
            url: 'https://discordapp.com/api/users/@me',
            headers: {
                'User-Agent': 'request',
                'Authorization': `Bearer ${req.query.token}`
            },
            json: true
        });

        // Get users connected guilds
        let guilds = await request({
            url: 'https://discordapp.com/api/users/@me/guilds',
            headers: {
                'User-Agent': 'request',
                'Authorization': `Bearer ${req.query.token}`
            },
            json: true
        });

        console.log(user);
        console.log(guilds);

        // Must be a verified user
        if (!user.verified) {
            res.sendFile(path.join(__dirname, 'static/notVerified.html'));
            return;
        }

        // Check if in the server
        if (!guilds.some(guild => { return guild.id === GAME_DEV_SERVER_ID })) {
            res.sendFile(path.join(__dirname, 'static/joinServer.html'));
            return;
        }
        
        // Can set session params
        if (req.session.userID !== user.id) {
            req.session.userID = user.id;
            req.session.username = user.username;
            req.session.avatar = `https://cdn.discordapp.com/${user.avatar ? `avatars/${user.id}/${user.avatar}.png` : `embed/avatars/${user.discriminator % 5}`}`;
        }

        res.redirect('/');
        return;
    }
    res.render('index', { ifuser: req.session.userID != undefined, username: req.session.username, avatar: req.session.avatar });
});

app.get('/invalidToken', (req, res) => {
    res.sendFile(path.join(__dirname, 'static/invalidToken.html'));
});

app.use('/connect', require('./api/discord'));

app.use('/css', express.static(path.join(__dirname, 'static', 'css')));

app.use('/js', express.static(path.join(__dirname, 'static', 'js')));

app.listen(PORT, () => {
    console.log(`listening on port: ${PORT}`);
});