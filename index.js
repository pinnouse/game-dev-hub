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
const bodyParser = require('body-parser');
const express = require('express');

const path = require('path');
const fs = require('fs');

const genuuid = require('uuid/v4');

const request = require('request-promise-native');

var app = express();

const DB = require('./database');
const db = new DB();

const PORT = 8080;

const GAME_DEV_SERVER_ID = "489531295848726528";


app.engine('html', function(filePath, options, callback) {
    fs.readFile(filePath, function(err, content) {
        if (err) return callback(err);

        var rendered = content.toString();
        if (options.ifuser) {
            rendered = rendered.replace(/\[ifuser[\s]?([^\]]+)\]\]/gim, "$1").replace(/\[ifnuser[\s]?[^\]]+\]\]/gim, "");
        } else {
            rendered = rendered.replace(/\[ifnuser[\s]?([^\]]+)\]\]/gim, "$1").replace(/\[ifuser[\s]?[^\]]+\]\]/gim, "");
        }

        rendered = rendered.replace(/{username}/gm, options.username)
        .replace(/{avatar}/gm, options.avatar)
        .replace(/{bio}/gm, options.bio)
        .replace(/{failed}/gm, options.failed)
        .replace(/{posts}/gm, options.posts)
        .replace(/{users}/gm, JSON.stringify(options.users));
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
    cookie: {
        secure: false
    }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

// Remove trailing
app.use((req, res, next) => {
    const test = /\?[^]*\//.test(req.url);
    if (req.url.substr(-1) === '/' && req.url.length > 1 && !test)
        res.redirect(301, req.url.slice(0, -1));
    else
    next();
});

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

        console.log(req.query);

        //console.log(user);
        //console.log(guilds);

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

            if (!db.hasUser(req.session.userID)) {
                db.addUser(
                    req.session.userID,
                    req.session.username,
                    req.session.avatar,
                    req.query.token,
                    req.query.refresh,
                    "No bio provided.");
            }
        }

        res.redirect('/');
        return;
    }
    res.render('index', { ifuser: req.session.userID !== undefined, username: req.session.username, avatar: req.session.avatar });
});

app.get('/profile', (req, res) => {
    let bio = "";
    if (req.session.userID && db.hasUser(req.session.userID)) {
        bio = db.getUserBio(req.session.userID);
    }
    res.render('profile', { ifuser: req.session.userID !== undefined, username: req.session.username, avatar: req.session.avatar, bio: bio, failed: false });
});

app.post('/profile', (req, res) => {
    let failed = true;
    let bio = "";
    if (req.session.userID && req.body.bioText) {
        bio = db.getUserBio(req.session.userID);
        failed = !db.updateUserBio(req.session.userID, req.body.bioText);
        if (!failed) bio = req.body.bioText;
    }
    res.render('profile', { ifuser: req.session.userID !== undefined, username: req.session.username, avatar: req.session.avatar, bio: bio, failed: failed });
});

app.get('/users', (req, res) => {
    let users = db.getAllUsers();
    res.render('users', { ifuser: req.session.userID !== undefined, username: req.session.username, avatar: req.session.avatar, users: users });
});

app.get('/users/:userId', (req, res) => {
    let user = db.getUserByUID(req.params.userId);
    let failed = user === undefined || user == {};
    res.render('user', {ifuser: !failed, username: user.username, avatar: user.avatar, bio: user.bio });
});

app.get('/logoutSuccess', (req, res) => {
    res.sendFile(path.join(__dirname, 'static/logoutSuccess.html'));
});

app.get('/invalidToken', (req, res) => {
    res.sendFile(path.join(__dirname, 'static/invalidToken.html'));
});

app.use('/connect', require('./router/discord'));

app.use('/css', express.static(path.join(__dirname, 'static', 'css')));

app.use('/js', express.static(path.join(__dirname, 'static', 'js')));

app.listen(PORT, () => {
    console.log(`listening on port: ${PORT}`);
});