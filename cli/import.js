#!/usr/bin/env node
'use strict';

/**
 * 账号导入 CLI
 *
 *   node cli/import.js accounts.json          # 导入 JSON
 *   node cli/import.js accounts.csv           # 导入 CSV（首行为表头）
 *   cat accounts.json | node cli/import.js -  # 从标准输入导入
 *
 * 可选参数：
 *   --region 美区      给未指定 region 的记录设默认地区
 *   --status available 给未指定 status 的记录设默认状态
 *   --dry-run          只解析并打印，不写库
 *
 * 支持字段：email / password / region / status / note / sort_order
 * 字段别名：account、username → email；pwd、pass → password
 */

const fs = require('fs');
const { Accounts } = require('../src/db');

/* ------------------------------ 参数解析 ------------------------------ */

const argv = process.argv.slice(2);
const file = argv.find((arg) => !arg.startsWith('--'));
const hasFlag = (name) => argv.includes(`--${name}`);
const flagValue = (name, fallback) => {
  const idx = argv.indexOf(`--${name}`);
  return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : fallback;
};

const dryRun = hasFlag('dry-run');
const defaultRegion = flagValue('region', '');
const defaultStatus = flagValue('status', '');

if (!file) {
  console.error('用法: node cli/import.js <accounts.json|accounts.csv|->');
  process.exit(1);
}

/* ------------------------------ 读取输入 ------------------------------ */

function readInput() {
  if (file === '-') {
    try {
      return fs.readFileSync(0, 'utf8');
    } catch (err) {
      console.error('无法读取标准输入:', err.message);
      process.exit(1);
    }
  }
  if (!fs.existsSync(file)) {
    console.error(`文件不存在: ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

/* ------------------------------ 格式解析 ------------------------------ */

/** 极简 CSV 解析：支持双引号包裹的字段 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const split = (line) => {
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ',') {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const header = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row = {};
    header.forEach((key, i) => {
      row[key] = cells[i] === undefined ? '' : cells[i];
    });
    return row;
  });
}

function parseInput(raw) {
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (text.startsWith('[') || text.startsWith('{')) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    // 兼容 { data: [...] } / { accounts: [...] } 这类包裹结构
    const list = parsed.data || parsed.accounts || parsed.list;
    if (Array.isArray(list)) return list;
    return [parsed];
  }
  return parseCsv(text);
}

/** 归一化字段名与默认值 */
function normalize(row) {
  const pick = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && String(row[key]).trim() !== '') return String(row[key]).trim();
    }
    return '';
  };

  return {
    email: pick('email', 'account', 'username', 'mail'),
    password: pick('password', 'pwd', 'pass'),
    region: pick('region', 'country', 'area') || defaultRegion || '未分区',
    status: pick('status', 'state') || defaultStatus || 'available',
    note: pick('note', 'remark', 'comment'),
    sort_order: pick('sort_order', 'order') || 0,
  };
}

/* -------------------------------- 主流程 -------------------------------- */

let rows;
try {
  rows = parseInput(readInput());
} catch (err) {
  console.error('解析失败:', err.message);
  process.exit(1);
}

if (!rows.length) {
  console.error('没有解析到任何记录。');
  process.exit(1);
}

let imported = 0;
const skipped = [];

for (const raw of rows) {
  const account = normalize(raw);

  if (!account.email || !account.password) {
    skipped.push(account.email || '(空)');
    continue;
  }

  if (dryRun) {
    console.log(
      `[dry-run] ${account.email} | ${account.region} | ${account.status} | ${account.password.slice(0, 3)}***`
    );
    imported += 1;
    continue;
  }

  Accounts.upsert(account);
  imported += 1;
}

if (!dryRun) {
  const { total, byRegion } = Accounts.stats();
  console.log(`\n导入完成：${imported} 条`);
  console.log(`当前账号总数：${total}`);
  if (byRegion.length) {
    console.log('地区分布：' + byRegion.map((r) => `${r.region} ${r.n}`).join(' / '));
  }
} else {
  console.log(`\n[dry-run] 可导入 ${imported} 条（未写库）`);
}

if (skipped.length) {
  console.warn(`\n跳过 ${skipped.length} 条（缺少 email 或 password）：${skipped.slice(0, 5).join(', ')}`);
}
