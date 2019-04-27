'use strict';

const Database = require('better-sqlite3');
const db = new Database('gdh.db');

const fs = require('fs');

const { promisify } = require('util');

const readFile = promisify(fs.readFile);

const tables = ['users', 'posts'];

/*
const dbStmt = {
  createUserTable: db.prepare(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      discId INTEGER NOT NULL,
      access_token VARCHAR(30),
      refresh_token VARCHAR(30),
      bio VARCHAR(900)
    )
  `),
  checkUserTable: db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='users'
  `),
  addUser: db.prepare(`
    INSERT INTO users (id, discId, access_token, refresh_token, bio)
    VALUES (?, ?, ?, ?, ?)
  `),
  getUser: db.prepare(`
    SELECT * FROM users
    WHERE id = ?
  `)
};*/

class DB {

  constructor() {
    this.init();
  }

  /**
   * Initializes database by reading from the schema to create required tables
   */
  init() {
    const schema = fs.readFileSync('schema.sql', 'utf8');
    db.exec(schema);

    const checkStmt = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name IN ('${tables.join("','")}')
    `);
    let result = checkStmt.all();
    return result.length == 2;
  }

  /**
   * Adds a user to the database. Returns a boolean of whether or not the
   * operation was successful.
   * 
   * @param {Snowflake} discordId Discord's provided user ID
   * @param {String} username Discord username
   * @param {String} avatar URL to Discord avatar
   * @param {String} accessToken Discord API Access Token
   * @param {String} refreshToken Discord API Refresh Token to keep token up to date
   * @param {String} bio Bio information for user
   * @returns {boolean}
   */
  addUser(discordId, username, avatar, accessToken, refreshToken, bio) {
    if (this.hasUser(discordId)) return true;
    const stmt = db.prepare(`
      INSERT INTO users (discId, username, avatar, access_token, refresh_token, bio)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    try {
      let info = stmt.run(discordId, username, avatar, accessToken, refreshToken, bio);
      if (info.changes !== 1) return false;
    } catch(e) {
      console.error(e);
      return false;
    }
    return true;
  }

  /**
   * Update a users bio info in the database, checking and verifying that the
   * input is appropriate.
   * 
   * @param {Snowflake} discordId Discord's provided user ID
   * @param {String} bio New bio to be updated
   * @returns {boolean}
   */
  updateUserBio(discordId, bio) {
    bio = bio.trim();
    if (/<script>/gim.test(bio)
      || bio.length > 900
      || !this.hasUser(discordId))
      return false;
    
    const stmt = db.prepare(`
      UPDATE users SET bio=? WHERE discId=? LIMIT 1
    `);

    let info;
    try {
      info = stmt.run(bio, discordId);
    } catch(e) {
      console.error(e);
      return false;
    }
    
    return info.changes === 1;
  }

  /**
   * Gets user bio from database from provided DiscordID.
   * 
   * @param {Snowflake} discordId Discord's provided user ID
   * @returns {String}
   */
  getUserBio(discordId) {
    if (!this.hasUser(discordId)) return "";
    const stmt = db.prepare(`
      SELECT bio FROM users WHERE discId=? LIMIT 1
    `);
    let obj = stmt.get(discordId);
    return obj.bio;
  }

  /**
   * Returns whether a user with the DiscordID already exists in the database.
   * 
   * @param {Snowflake} discordId Discord's provided user ID
   * @returns {boolean}
   */
  hasUser(discordId) {
    const stmt = db.prepare(`
      SELECT id FROM users WHERE discId=? LIMIT 1
    `);
    let id = stmt.get(discordId);
    return id !== undefined;
  }

  /**
   * Gets all the users from the database
   * 
   * @returns {Array.<object>}
   */
  getAllUsers() {
    const stmt = db.prepare(`
      SELECT id, username, avatar, bio FROM users ORDER BY id DESC
    `);

    let results = [];
    try {
      results = stmt.all();
    } catch(e) {
      console.error(e);
    }

    return results;
  }

  /**
   * Gets a user's information based on their ID in the database
   * 
   * @param {int} userId ID of user in database NOT their Discord ID
   * @returns {object}
   */
  getUserByUID(userId) {
    const stmt = db.prepare(`
      SELECT username, avatar, bio FROM users WHERE id=? LIMIT 1
    `);

    try {
      let user = stmt.get(userId);
      return user;
    } catch(e) {
      console.error(e);
    }

    return {};
  }
  
}

module.exports = DB;