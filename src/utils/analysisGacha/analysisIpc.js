const { ipcMain, clipboard } = require('electron');
const { db2 } = require('../../app/database'); // 引入数据库实例
const { parseGachaUrl, fetchAllGachaLogs } = require('./gachaUtils'); // 工具方法
const { getGamePath, extractGachaUrl } = require("./getWutheringWavesPath"); // 获取游戏路径和祈愿链接
const db = db2; // 数据库实例

// 导入其他抽卡分析IPC
require('./miHoMo/genShinIpc');
require('./miHoMo/starRailIpc');
require('./miHoMo/zzzIpc');
require('./deleteUID');
require('./commonitems');
require('./gachaDelete');


/**
 * 获取上次查询的玩家 UID
 */
ipcMain.handle('get-last-query-uid', async () => {
    try {
        const row = await new Promise((resolve, reject) => {
            db.get(
                'SELECT player_id FROM gacha_logs ORDER BY timestamp DESC LIMIT 1',
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
        return row ? row.player_id : null;
    } catch (err) {
        console.error('Error fetching last query UID:', err);
        return null;
    }
});

/**
 * 获取所有玩家 UID
 */
ipcMain.handle('get-player-uids', async () => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(
                'SELECT DISTINCT player_id FROM gacha_logs',
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
        return rows.map(row => row.player_id);
    } catch (err) {
        console.error('Error fetching player UIDs:', err);
        return [];
    }
});

/**
 * 获取所有祈愿记录
 */
// 获取祈愿记录
ipcMain.handle('get-gacha-records', async () => {
    try {
        const rows = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM gacha_logs ORDER BY id DESC', // 按插入顺序倒序获取
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
        return rows;
    } catch (err) {
        console.error('Error fetching gacha records:', err);
        return [];
    }
});


/**
 * 刷新祈愿记录
 */
ipcMain.handle('refresh-gacha-records', async (event) => {
    try {
        event.sender.send('gacha-records-status', '正在获取抽卡记录...');

        const gamePath = await getGamePath();
        const gachaUrl = await extractGachaUrl(gamePath);

        if (!gachaUrl) throw new Error('未找到祈愿链接');
        console.log("抽卡链接为：", gachaUrl);
        clipboard.writeText(gachaUrl);
        event.sender.send('gacha-records-status', '获取到抽卡链接，已复制到剪贴板');

        const params = parseGachaUrl(gachaUrl);
        const { totalRecords, newRecords } = await fetchAllGachaLogs(params, event);

        event.sender.send('gacha-records-status', `本次共查询到 ${totalRecords} 条记录，新增 ${newRecords} 条记录。抽卡链接已复制到剪贴板`);
        if (totalRecords === 0){
            global.Notify(false, `链接可能已经过期，请尝试重新打开抽卡界面`);
            return { success: false, totalRecords, newRecords };
        }else {
            return { success: true, totalRecords, newRecords };
        }
    } catch (err) {
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        console.error("获取记录失败:", errorMessage);
        event.sender.send('gacha-records-status', `获取记录失败: ${errorMessage}`);
        global.Notify(false, errorMessage);
        return { success: false, error: errorMessage };
    }
});


// 获取鸣潮路径
ipcMain.handle('get-wuthering-waves-gacha-url', async () => {
    try {
        const gamePath = await getGamePath(); // 调用更新后的函数
        const gachaUrl = await extractGachaUrl(gamePath);
        return { success: true, gachaUrl };
    } catch (err) {
        console.error("获取祈愿链接失败:", err.message);
        return { success: false, error: err.message };
    }
});
