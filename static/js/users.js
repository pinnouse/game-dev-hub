'use strict';

$(() => {
    users.forEach(u => {
        $('#users').append(`
            <a href="users/${u.id}" ${(username+avatar === u.username+u.avatar) ? 'class="me"' : ""}><span><img src="${u.avatar}?size=128">${u.username}</span></span>
        `);
    });
});