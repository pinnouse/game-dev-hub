'use strict';

const Database = require('better-sqlite3');
const db = new Database('gdh.db');

const fs = require('fs');

const tables = ['users', 'posts'];

/**
 * @typedef {Object} User
 * @property {string} username User's username
 * @property {string} avatar Users's avatar URL
 * @property {string} bio User's bio
 * @property {string} access_token Discord access token for API interaction
 * @property {string} refresh_token Token to refresh the Discord access token
 * 
 * @typedef {Object} Post
 * @property {number} id ID of the post in the database
 * @property {string} associated_user The associated user who added the post
 * @property {string} title Title of post article
 * @property {string} description Post description (max 900 chars.)
 * @property {string} link The URL to where the user can download the file
 */

/** Class representing a database object */
class DB {
  /**
   * Instantiates a database object
   */
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
   * @param {string} discordId Discord's provided user ID (snowflake)
   * @param {string} username Discord username
   * @param {string} avatar URL to Discord avatar
   * @param {string} accessToken Discord API Access Token
   * @param {string} refreshToken Discord API Refresh Token to keep token up to date
   * @param {string} bio Bio information for user
   * @returns {boolean}
   */
  addUser(discordId, username, avatar, accessToken, refreshToken, bio) {
    if (this.hasUser(discordId)) return true;
    const stmt = db.prepare(`
      INSERT INTO users (discId, username, avatar, access_token, refresh_token, bio)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let info;
    try {
      info = stmt.run(discordId, username, avatar, accessToken, refreshToken, bio);
    } catch(e) {
      console.error(e);
    }

    return info.changes === 1;
  }

  /**
   * Update a users bio info in the database, checking and verifying that the
   * input is appropriate.
   * 
   * @param {number} discordId Discord's provided user ID
   * @param {string} bio New bio to be updated
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
    }
    
    return info.changes === 1;
  }

  /**
   * Gets user bio from database from provided DiscordID.
   * 
   * @param {number} discordId Discord's provided user ID
   * @returns {string}
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
   * @param {number} discordId Discord's provided user ID
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
   * Gets all the users from the database.
   * 
   * @returns {User[]}
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
   * Gets a user's information based on their ID in the database.
   * 
   * @param {number} userId ID of user in database NOT their Discord ID
   * @returns {User}
   */
  getUserByUID(userId) {
    const stmt = db.prepare(`
      SELECT username, avatar, bio, access_token, refresh_token FROM users WHERE id=? LIMIT 1
    `);

    try {
      let user = stmt.get(userId);
      return user;
    } catch(e) {
      console.error(e);
    }
    
    return undefined;
  }

  /**
   * Gets all posts from database.
   * 
   * @returns {Post[]}
   */
  getAllPosts() {
    const stmt = db.prepare(`
      SELECT * FROM posts ORDER BY id DESC
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
   * Add a post to the database, making sure the description does not exceed
   * 900 characters. Returns whether the operation succeeded or not.
   * 
   * @param {string} title Title of the post
   * @param {string} description Description of post (max 900 chars.)
   * @param {number} userId The ID in the database of the associated user
   * @param {string} link URL of where to access/download product
   * @returns {boolean}
   */
  addPost(title, description, userId, link) {
    title = title.trim();
    description = description.trim();
    link = link.trim();
    if (title.length > 50
      || /<script>/gim.test(description)
      || description.length > 900
      || link.length > 50
      || !/http[s]?:\/\/[\w]+\.[\w]{2,3}(?:\/[^]*)?/gim.test(link)
      || !this.getUserByUID(userId) === undefined)
      return false;
    
    title = title.replace(/[<>]|&[\w]*;/gim, "").trim();
    
    const stmt = db.prepare(`
      INSERT INTO posts (associated_user, title, description, link)
      VALUES (?, ?, ?, ?)
    `);

    let info;
    try {
      info = stmt.run(title, description, userId, link);
    } catch(e) {
      console.error(e);
    }
    
    return info.changes === 1;
  }

  /**
   * Get a post from the database based on the ID
   * 
   * @param {number} postId Post ID in database
   * @returns {Post}
   */
  getPost(postId) {
    const stmt = db.prepare(`
      SELECT * FROM posts WHERE id=? LIMIT 1
    `);

    let post;
    try {
      post = stmt.get(postId);
      return post;
    } catch(e) {
      console.error(e);
    }

    return undefined;
  }
  
}

module.exports = DB;