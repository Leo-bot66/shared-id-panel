'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(path.join(config.dataDir, 'panel.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    NOT NULL,
    password   TEXT    NOT NULL,
    region     TEXT    NOT NULL DEFAULT '未分区',
    status     TEXT    NOT NULL DEFAULT 'available',
    note       TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE (email)
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_region ON accounts(region);
  CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
`);

/**
 * status 取值：
 *   available   —— 可用（默认）
 *   unavailable —— 维护中
 *   hidden      —— 不下发给前端（保留在库里但不展示）
 */
const Accounts = {
  all(includeHidden = false) {
    const sql = includeHidden
      ? 'SELECT * FROM accounts ORDER BY sort_order, region, id'
      : "SELECT * FROM accounts WHERE status != 'hidden' ORDER BY sort_order, region, id";
    return db.prepare(sql).all();
  },

  byId(id) {
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  },

  upsert(account) {
    return db
      .prepare(
        `INSERT INTO accounts (email, password, region, status, note, sort_order, updated_at)
         VALUES (@email, @password, @region, @status, @note, @sort_order, datetime('now','localtime'))
         ON CONFLICT(email) DO UPDATE SET
           password   = excluded.password,
           region     = excluded.region,
           status     = excluded.status,
           note       = excluded.note,
           sort_order = excluded.sort_order,
           updated_at = datetime('now','localtime')`
      )
      .run({
        email: String(account.email || '').trim(),
        password: String(account.password || '').trim(),
        region: (account.region || '未分区').trim(),
        status: (account.status || 'available').trim(),
        note: String(account.note || '').trim(),
        sort_order: Number.parseInt(account.sort_order, 10) || 0,
      });
  },

  remove(email) {
    return db.prepare('DELETE FROM accounts WHERE email = ?').run(String(email).trim());
  },

  stats() {
    const rows = db
      .prepare(
        "SELECT region, COUNT(*) AS n FROM accounts WHERE status != 'hidden' GROUP BY region ORDER BY n DESC"
      )
      .all();
    const total = rows.reduce((sum, row) => sum + row.n, 0);
    return { total, byRegion: rows };
  },
};

module.exports = { db, Accounts };
