'use strict';

const path = require('path');
const express = require('express');
const config = require('./src/config');
const { Accounts } = require('./src/db');

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/static', express.static(path.join(__dirname, 'public', 'static'), { maxAge: '7d' }));

/** 地区中文名 → 两位缩写（用于徽章展示） */
const REGION_MAP = [
  ['美', 'US'],
  ['港', 'HK'],
  ['台', 'TW'],
  ['日', 'JP'],
  ['英', 'UK'],
  ['韩', 'KR'],
  ['新', 'SG'],
  ['土', 'TR'],
  ['菲', 'PH'],
  ['加', 'CA'],
];

function regionCode(region = '') {
  const hit = REGION_MAP.find(([keyword]) => region.includes(keyword));
  return hit ? hit[1] : 'ID';
}

/* ---------------------------------- 页面 ---------------------------------- */

app.get('/', (req, res) => {
  const rows = Accounts.all();
  const accounts = rows.map((row) => ({
    id: row.id,
    email: row.email,
    region: row.region,
    regionCode: regionCode(row.region),
    status: row.status,
    note: row.note,
    updated_at: row.updated_at,
    // 按需显示模式：首屏只下发掩码，真实密码走 /api/accounts/:id/password
    password: config.revealOnClick ? '' : row.password,
  }));

  res.render('index', {
    config,
    accounts,
    stats: Accounts.stats(),
  });
});

/* ---------------------------------- API ---------------------------------- */

app.get('/api/accounts', (req, res) => {
  const data = Accounts.all().map((row) => ({
    id: row.id,
    email: row.email,
    region: row.region,
    regionCode: regionCode(row.region),
    status: row.status,
    note: row.note,
    updated_at: row.updated_at,
    ...(config.revealOnClick ? {} : { password: row.password }),
  }));

  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, total: data.length, data });
});

app.get('/api/accounts/:id/password', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, message: 'invalid id' });
  }

  const row = Accounts.byId(id);
  if (!row || row.status === 'hidden') {
    return res.status(404).json({ ok: false, message: 'not found' });
  }

  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, data: { id: row.id, password: row.password } });
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, stats: Accounts.stats() });
});

app.use((req, res) => res.status(404).type('text/plain').send('Not Found'));

/* --------------------------------- 启动 --------------------------------- */

app.listen(config.port, () => {
  const { total } = Accounts.stats();
  console.log(`[shared-id-panel] 已启动: http://0.0.0.0:${config.port}`);
  console.log(`[shared-id-panel] 当前账号数: ${total}（按需显示密码: ${config.revealOnClick ? '开' : '关'}）`);
});
