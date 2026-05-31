const { db2 } = require('../../../app/database');
const { get } = require("axios");
const db = db2;
const {getGenshinWishUrl} = require("./getGenshinUrl");
const {fetchGachaRecords} = require("./fetchGacha");

// 定义祈愿类型映射
const GACHA_TYPE_MAP = {
    "1000": "常驻颂愿",
    "2000": "活动颂愿"
};

async function insertGachaLogs(logs) {
    let insertedCount = 0;
    const insertPromises = logs.map(log => {
        return new Promise((resolve, reject) => {
            // 修正字段映射，兼容不同的 API 返回格式
            const id = log.id;
            const uid = log.uid;
            const gacha_id = log.schedule_id || log.gacha_id || "";
            const gacha_type = log.op_gacha_type || log.gacha_type || "";
            const item_id = log.item_id || "";
            const count = log.count || 1; // 默认 1
            const time = log.time;
            const name = log.item_name || log.name || "";
            const lang = log.lang || "zh-cn";
            const item_type = log.item_type || "";
            const rank_type = log.rank_type || "";

            db.run(
                `INSERT OR IGNORE INTO miliastra_gacha (id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type],
                function (err) {
                    if (err) {
                        reject(`插入失败: ${err.message}`);
                    } else {
                        if (this.changes > 0) {
                            insertedCount++;
                        }
                        resolve();
                    }
                }
            );
        });
    });
    // 等待所有插入操作完成
    await Promise.all(insertPromises);
    console.log(`成功插入 ${insertedCount} 条数据`);
    return insertedCount;
}

async function fetchMiliastraGachaData(event) {
    // 获取抽卡记录链接
    const result = await getGenshinWishUrl();
    if (!result.success) {
        console.error(result.message);
        return {success: result.success, message:result.message};
    }

    const gachaUrl = result.message.split('\n')[1].trim();
    console.log(`获取的抽卡记录链接: ${gachaUrl}`);
    global.Notify(true, `已获取抽卡链接并复制到剪贴板\n${gachaUrl}`)
    // 获取祈愿日志数据
    try {
        const allRecords = { '1000': [], '2000': []};
        let totalFetched = await fetchGachaRecords(allRecords,GACHA_TYPE_MAP,gachaUrl,event);
        // 插入查询到的所有数据
        const totalInserted = await insertGachaLogs(allRecords['1000'].concat(allRecords['2000']));
        event.sender.send('gacha-records-status', `查询到的抽卡记录: ${totalFetched} 条,成功插入: ${totalInserted} 条`);
        return { success: true, message: `查询到的抽卡记录: ${totalFetched} 条\n成功插入: ${totalInserted} 条`};
    } catch (error) {
        console.error('获取抽卡数据时出错:', error);
        event.sender.send('gacha-records-status', `获取抽卡数据时出错:${error}`);
        return { success: false, message: `获取抽卡数据时出错\n${error}`};
    }
}

module.exports = { fetchMiliastraGachaData }
