'use strict';

const path = require('path');
require('dotenv').config();

const bool = (value, fallback) =>
  value === undefined ? fallback : String(value).toLowerCase() === 'true';

const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

module.exports = {
  port: Number.parseInt(process.env.PORT || '3000', 10),

  siteName: process.env.SITE_NAME || '共享 Apple ID 面板',

  siteUrl,

  siteDescription:
    process.env.SITE_DESCRIPTION ||
    '美区、香港区、台湾区 Apple ID 共享账号实时状态展示，密码按需获取、复制即用。',

  /** 账号数据目录（SQLite 落盘位置），Docker 部署时挂载出来可持久化 */
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),

  /**
   * true（默认）= 首屏 HTML 不输出明文密码，点击「显示密码」才向后端按需请求。
   * 这是防爬的关键设计：批量抓取首页拿不到任何密码。
   */
  revealOnClick: bool(process.env.REVEAL_ON_CLICK, true),

  /** 页面是否展示账号更新时间 */
  showUpdatedAt: bool(process.env.SHOW_UPDATED_AT, true),

  /** 版权/免责声明文案，展示在账号列表下方 */
  footerNote:
    process.env.FOOTER_NOTE ||
    '共享账号仅供下载被下架应用使用，请勿登录 iCloud，下载完成后请及时退出。',
};
