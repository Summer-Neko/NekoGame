const fs = require('fs');
const path = require('path');
const { db2 } = require('../../../app/database');
const { ipcMain } = require('electron');
const { fetchItemId, itemCache } = require("./UIGFapi");

// 游戏类型
const fieldSchemas = {
    hk4e: ["gacha_id", "gacha_type", "item_id", "count", "time", "name", "item_type", "rank_type", "id", "uigf_gacha_type"],
    hkrpg: ["gacha_id", "gacha_type", "item_id", "count", "time", "name", "item_type", "rank_type", "id"],
    nap: ["gacha_id", "gacha_type", "item_id", "count", "time", "name", "item_type", "rank_type", "id"]
};
async function validateAndFormatRecord(record, schema, gameType) {
    const formattedRecord = {};
    for (const field of schema) {
        if (record[field] !== undefined && record[field] !== null) {
            formattedRecord[field] = record[field].toString();
        } else {
            // 如果确实字段内容
            formattedRecord[field] = "";
        }
    }
    // 如果 item_id 缺失，通过 UIGFapi 获取
    if (!formattedRecord.item_id && record.name) {
        try {
            const itemId = await fetchItemId(record.name, "chs", gameType);
            formattedRecord.item_id = itemId.toString();
        } catch (error) {
            console.warn(`无法获取 item_id，name: ${record.name}`, error.message);
        }
    }
    // 补充 uigf_gacha_type
    if (record.gacha_type) {
        // 如果 gacha_type 为 301 或 400，统一映射为 301 角色活动祈愿
        const normalizedGachaType = record.gacha_type === '400' ? '301' : record.gacha_type.toString();
        formattedRecord.uigf_gacha_type = normalizedGachaType;
    }
    return formattedRecord;
}



// 导出方法
async function exportUIGFData({ tableName, type, outputFileName, schema, gameType, selectedUIDs }) {
    const query = `SELECT * FROM ${tableName} WHERE uid IN (${selectedUIDs.map(() => '?').join(',')}) ORDER BY id ASC`;
    const outputPath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'export');
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }

    try {
        const records = await new Promise((resolve, reject) => {
            db2.all(query, selectedUIDs, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (records.length === 0) {
            throw new Error(`没有找到 UID: ${selectedUIDs.join(', ')} 的记录`);
        }

        const formattedData = {
            info: {
                export_timestamp: Math.floor(Date.now() / 1000),
                export_app: "NekoGame",
                export_app_version: "2.3.17",
                version: "v4.0"
            },
            [type]: []
        };

        const groupedByUID = {};
        for (const record of records) {
            if (!groupedByUID[record.uid]) {
                groupedByUID[record.uid] = {
                    uid: record.uid,
                    timezone: 8,
                    lang: record.lang || "zh-cn",
                    list: []
                };
            }
            const formattedRecord = await validateAndFormatRecord(record, schema, gameType);
            groupedByUID[record.uid].list.push(formattedRecord);
        }

        formattedData[type] = Object.values(groupedByUID);

        const outputFile = path.resolve(outputPath, outputFileName);
        fs.writeFileSync(outputFile, JSON.stringify(formattedData, null, 4), 'utf-8');
        console.log(`抽卡数据已成功导出: ${outputFile}`);
        global.Notify(true, `已成功导出 UID: ${selectedUIDs.join(', ')}\n文件路径: ${outputFile}`);
    } catch (error) {
        console.error("导出 UIGF 数据时发生错误:", error.message);
        global.Notify(false, `导出 UIGF 数据时发生错误: ${error.message}`);
        return; //错误后终止
    }
}

// IPC 处理
ipcMain.handle('export-genshin-data', async (event, selectedUIDs) => {
    await exportUIGFData({
        tableName: 'genshin_gacha',
        type: 'hk4e',
        outputFileName: `UIGF4_genshin_gacha_${selectedUIDs.join('_')}_NekoGame.json`,
        schema: fieldSchemas.hk4e,
        gameType: 'genshin',
        selectedUIDs
    });
});

ipcMain.handle('export-miliastra-data', async (event, selectedUIDs) => {
    await exportUIGFData({
        tableName: 'miliastra_gacha',
        type: 'hk4e',
        outputFileName: `UIGF4_miliastra_gacha_${selectedUIDs.join('_')}_NekoGame.json`,
        schema: fieldSchemas.hk4e,
        gameType: 'genshin',
        selectedUIDs
    });
});

ipcMain.handle('export-starRail-data', async (event, selectedUIDs) => {
    await exportUIGFData({
        tableName: 'starRail_gacha',
        type: 'hkrpg',
        outputFileName: `UIGF4_starRail_gacha_${selectedUIDs.join('_')}_NekoGame.json`,
        schema: fieldSchemas.hkrpg,
        gameType: 'starRail',
        selectedUIDs
    });
});

ipcMain.handle('export-zzz-data', async (event, selectedUIDs) => {
    await exportUIGFData({
        tableName: 'zzz_gacha',
        type: 'nap',
        outputFileName: `UIGF4_zzz_gacha_${selectedUIDs.join('_')}_NekoGame.json`,
        schema: fieldSchemas.nap,
        gameType: 'zzz',
        selectedUIDs
    });
});
