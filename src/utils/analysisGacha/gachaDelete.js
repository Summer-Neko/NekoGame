const { ipcMain } = require('electron');
const { db2 } = require("../../app/database");
const db = db2;

// 白名单
const ALLOWED_GACHA_TABLES = new Set([
  'genshin_gacha',
  'starRail_gacha',
  'zzz_gacha',
  'gacha_logs'
]);

/** 转可比较的时间字符串 */
function toSqliteTimeString(input) {
  if (!input) return null;

  // 已经是 "YYYY-MM-DD HH:mm:ss"
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input)) {
    return input;
  }

  const d = (input instanceof Date) ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Promise 化 db
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // this.changes
    });
  });
}

/** 自动识别表中的时间列 */
async function getTimeColumn(table) {
  const cols = await dbAll(`PRAGMA table_info(${table})`);
  const names = new Set(cols.map(c => c.name));

  const candidates = ['time', 'gacha_time', 'timestamp', 'date'];
  for (const c of candidates) {
    if (names.has(c)) return c;
  }
  return null;
}

/** 识别表中的 UID  */
async function getUidColumn(table) {
  const cols = await dbAll(`PRAGMA table_info(${table})`);
  const names = new Set(cols.map(c => c.name));

  // 优先自动探测（推荐顺序）
  const candidates = ['uid', 'player_id', 'user_id', 'account_id'];
  for (const c of candidates) {
    if (names.has(c)) return c;
  }

  // 按表名映射
  const map = {
    genshin_gacha: 'uid',
    starRail_gacha: 'uid',
    zzz_gacha: 'uid',
    gacha_logs: 'player_id'
  };
  return map[table] || null;
}

/** 统一校验 + 归一化 */
async function normalizePayload(payload) {
  const { uid, start, end, table } = payload || {};

  if (!uid) return { ok: false, message: '缺少 uid' };
  if (!table || !ALLOWED_GACHA_TABLES.has(table)) {
    return { ok: false, message: `非法表名：${table}` };
  }

  const startStr = toSqliteTimeString(start);
  const endStr = toSqliteTimeString(end);
  if (!startStr || !endStr) {
    return { ok: false, message: '时间格式无效（start/end）' };
  }

  const s = (startStr <= endStr) ? startStr : endStr;
  const e = (startStr <= endStr) ? endStr : startStr;

  const timeCol = await getTimeColumn(table);
  if (!timeCol) {
    return { ok: false, message: `表 ${table} 未找到可用时间列（time/gacha_time/timestamp/date）` };
  }

  const uidCol = await getUidColumn(table);
  if (!uidCol) {
    return { ok: false, message: `表 ${table} 未找到可用 UID 列（uid/player_id/...）` };
  }

  return { ok: true, uid, table, uidCol, timeCol, s, e };
}

/** 统计：某 UID 在时间区间内的记录数 */
ipcMain.handle('count-gacha-records-by-time', async (event, payload) => {
  try {
    const norm = await normalizePayload(payload);
    if (!norm.ok) return { success: false, count: 0, message: norm.message };

    const { uid, table, uidCol, timeCol, s, e } = norm;

    // ✅ 用反引号包住列名（列名来自 PRAGMA，不会是用户注入）
    const sql = `SELECT COUNT(1) AS cnt
                 FROM \`${table}\`
                 WHERE \`${uidCol}\` = ? AND \`${timeCol}\` >= ? AND \`${timeCol}\` <= ?`;

    const row = await dbGet(sql, [uid, s, e]);
    const count = Number(row?.cnt || 0);

    return { success: true, count, message: `范围内共有 ${count} 条（${uidCol}=${uid}, ${s} ~ ${e}）` };
  } catch (err) {
    return { success: false, count: 0, message: `统计失败: ${err.message}` };
  }
});

/** 删除：某 UID 在时间区间内的记录 */
ipcMain.handle('delete-gacha-records-by-time', async (event, payload) => {
  try {
    const norm = await normalizePayload(payload);
    if (!norm.ok) return { success: false, deleted: 0, message: norm.message };

    const { uid, table, uidCol, timeCol, s, e } = norm;

    const sql = `DELETE FROM \`${table}\`
                 WHERE \`${uidCol}\` = ? AND \`${timeCol}\` >= ? AND \`${timeCol}\` <= ?`;

    const ret = await dbRun(sql, [uid, s, e]);
    const deleted = Number(ret?.changes || 0);

    return { success: true, deleted, message: `已删除 ${deleted} 条（${uidCol}=${uid}, ${s} ~ ${e}）` };
  } catch (err) {
    return { success: false, deleted: 0, message: `删除失败: ${err.message}` };
  }
});
