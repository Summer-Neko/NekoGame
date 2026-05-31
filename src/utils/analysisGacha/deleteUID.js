
const { db2 } = require('../../app/database'); // 引入数据库
const { ipcMain } = require('electron');

ipcMain.handle('delete-gacha-records', async (event, uid, table) => {
    try {
        const allowedTables = ['genshin_gacha', 'starRail_gacha', 'zzz_gacha', 'miliastra_gacha', 'gacha_logs'];
        if (!allowedTables.includes(table)) {
            return { success: false, message: `非法的表名: ${table}` };
        }
        const query = `DELETE FROM ${table} WHERE uid = ?`;
        await new Promise((resolve, reject) => {
            db2.run(query, [uid], function (err) {
                if (err) reject(err);
                else resolve();
            });
        });
        return { success: true, message: `UID: ${uid} 的记录已成功从表 ${table} 中删除` };
    } catch (error) {
        return { success: false, message: `删除失败: ${error.message}` };
    }
});
