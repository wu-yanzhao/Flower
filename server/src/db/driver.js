'use strict';

/**
 * 数据库驱动适配层
 * ------------------------------------------------------------
 * 优先使用 Node.js 内置模块 node:sqlite（Node >= 22.5，零安装、免编译）；
 * 若运行环境版本较低，则自动回退到社区库 better-sqlite3（需 npm install better-sqlite3）。
 * 两者对外暴露统一的 prepare/run/get/all/exec 接口，业务层无感知。
 */

const CANDIDATES = [
  {
    name: 'node:sqlite',
    load() {
      const { DatabaseSync } = require('node:sqlite');
      return DatabaseSync;
    },
  },
  {
    name: 'better-sqlite3',
    load() {
      return require('better-sqlite3');
    },
  },
];

function createConnection(file) {
  let lastError = null;
  for (const candidate of CANDIDATES) {
    try {
      const Database = candidate.load();
      const db = new Database(file);
      db.exec('PRAGMA foreign_keys = ON;');
      return { db, driver: candidate.name };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    '无法初始化 SQLite：请先安装 Node.js >= 22.5（内置 node:sqlite），' +
      '或在 server 目录执行 npm install better-sqlite3。原始错误：' +
      (lastError && lastError.message)
  );
}

/**
 * 统一的事务包装：SQLite 不支持嵌套事务，这里用计数器做简单保护。
 */
function makeTransaction(db) {
  return function transaction(fn) {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
}

/**
 * 统一查询接口包装，抹平驱动差异。
 * - all(sql, params)  返回对象数组
 * - get(sql, params)  返回单条对象或 undefined
 * - run(sql, params)  返回 { changes, lastInsertRowid }
 */
function wrap(db) {
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
    run(sql, params = []) {
      const info = db.prepare(sql).run(...params);
      return {
        changes: Number(info.changes || 0),
        lastInsertRowid: Number(info.lastInsertRowid || 0),
      };
    },
    transaction: makeTransaction(db),
  };
}

module.exports = { createConnection, wrap };
