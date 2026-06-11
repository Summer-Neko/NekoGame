const axios = require('axios'); // 使用 axios 代替 fetch
const { db2 } = require('../../app/database'); // 引入数据库
const db = db2;  // 数据库实例
const { ipcMain } = require('electron');
// 祈愿类型映射
const GACHA_TYPE_MAP = {
    1: "角色活动唤取",
    2: "武器活动唤取",
    3: "角色常驻唤取",
    4: "武器常驻唤取",
    5: "新手唤取",
    6: "新手自选唤取",
    7: "感恩定向唤取",
    8: "角色新旅唤取",
    9: "武器新旅唤取",
    10: "角色联动唤取",
    11: "武器联动唤取",
};

const BASE_URL = "https://gmserver-api.aki-game2.com/gacha/record/query";
const HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Content-Type": "application/json",
};

/**
 * 获取所有类型的祈愿记录
 * @param {object} params 查询参数（不包含 cardPoolId）
 * @param event
 * @returns {Promise<object[]>} 祈愿记录数组
 */
async function fetchAllGachaLogs(params, event) {
    const allLogs = [];
    let totalNewRecords = 0; // 新增记录计数

    // 循环遍历 GACHA_TYPE_MAP，查询每种类型的祈愿记录
    for (const [cardPoolType, typeName] of Object.entries(GACHA_TYPE_MAP)) {
        console.log(`正在请求卡池类型 ${cardPoolType}: ${typeName}`);
        sendStatusToRenderer(event, `正在查询卡池: ${typeName}`);
        const currentParams = { ...params, cardPoolType: parseInt(cardPoolType, 10) };

        try {
            // 获取当前卡池的所有记录
            const logs = await fetchGachaLogsByType(currentParams, event);
            logs.forEach(log => {
                log.cardPoolType = typeName; // 使用定义的名称
            });

            allLogs.push(...logs); // 将所有记录收集到 allLogs 数组中

            // 插入或更新记录（按倒序插入，且根据时间戳插入新数据）
            const newRecordsCount = await insertOrUpdateGachaLogs(logs, params.playerId, event);
            totalNewRecords += newRecordsCount;
        } catch (err) {
            console.warn(`请求卡池类型 ${typeName} 时出错: ${err.message}`);
            if (err.response && err.response.status === 502) {
                // 如果遇到 502 错误，尝试重新获取数据
                console.log(`502 错误，尝试重试请求卡池类型 ${typeName}`);
                sendStatusToRenderer(event, `502 错误，尝试重试请求卡池类型 ${typeName}`);
                try {
                    const retryLogs = await retryFetch(currentParams, event);
                    retryLogs.forEach(log => (log.cardPoolType = typeName));
                    // 插入重试获取到的记录并统计新增记录数
                    const retryNewRecordsCount = await insertOrUpdateGachaLogs(retryLogs, params.playerId, event);
                    totalNewRecords += retryNewRecordsCount;
                    allLogs.push(...retryLogs);
                } catch (retryErr) {
                    console.error(`重试卡池类型 ${typeName} 时依然失败: ${retryErr.message}`);
                }
            }
        }
    }
    return { totalRecords: allLogs.length, newRecords: totalNewRecords };
}



/**
 * 按单个类型查询祈愿记录
 * @param {object} params 查询参数
 * @param event
 * @returns {Promise<object[]>} 返回单个卡池类型的祈愿记录数组
 */
async function fetchGachaLogsByType(params, event) {
    try {
        const response = await axios.post(BASE_URL, params, { headers: HEADERS });
        if (response.status !== 200) throw new Error(`HTTP 状态码: ${response.status}`);
        console.log(`获取到 ${response.data.data.length} 条记录，当前卡池类型: ${params.cardPoolType}`);
        sendStatusToRenderer(event, `获取到 ${response.data.data.length} 条记录，当前卡池类型: ${params.cardPoolType}`);
        return response.data.data;
    } catch (err) {
        global.Notify(false, `请求失败: ${err.message}`)
        console.error(`请求失败: ${err.message}`);
        throw err;
    }
}

/**
 * 尝试重试请求
 * @param {object} params 请求参数
 * @param event
 * @returns {Promise<object[]>} 重新请求并返回记录
 */
async function retryFetch(params, event) {
    let retries = 3;  // 设置最大重试次数
    let logs = [];

    while (retries > 0) {
        try {
            logs = await fetchGachaLogsByType(params, event);
            if (logs.length > 0) {
                return logs; // 如果成功获取数据，返回
            }
        } catch (err) {
            retries--;
            console.log(`重试失败, 剩余重试次数: ${retries}`);
            sendStatusToRenderer(event, `重试失败, 剩余重试次数: ${retries}`);
            if (retries === 0) {
                console.warn(`请求失败，跳过卡池类型 ${params.cardPoolType}`);
                sendStatusToRenderer(event, `请求失败，跳过卡池类型 ${params.cardPoolType}`);
                return []; // 如果重试次数耗尽，跳过当前卡池
            }
        }
    }

    return logs; // 重试结束，返回日志
}

/**
 * 解析祈愿链接，提取参数
 * @param {string} url 祈愿链接
 * @returns {object} 解析后的参数
 */
function parseGachaUrl(url) {
    const parsedUrl = new URL(url);
    const queryParams = new URLSearchParams(parsedUrl.search);
    const fragmentParams = new URLSearchParams(parsedUrl.hash.split("?")[1] || "");

    const getParam = (keySnake, keyCamel) => {
        return queryParams.get(keySnake) || fragmentParams.get(keySnake) ||
               queryParams.get(keyCamel) || fragmentParams.get(keyCamel) || "";
    };

    return {
        playerId: getParam("player_id", "playerId"),
        cardPoolId: getParam("resources_id", "cardPoolId"),
        cardPoolType: parseInt(getParam("gacha_type", "cardPoolType") || 0, 10),
        languageCode: getParam("lang", "languageCode") || "zh-Hans",
        serverId: getParam("svr_id", "serverId"),
        recordId: getParam("record_id", "recordId") || "0",
    };
}
/**
 * 插入获取到的祈愿记录到数据库
 * @param {object[]} logs 需要插入的祈愿记录数组
 * @param playerId
 * @param event
 */

// 插入获取到的祈愿记录到数据库（按倒序插入）
async function insertGachaLogs(logs, playerId, event) {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO gacha_logs (player_id, card_pool_type, resource_id, quality_level, resource_type, name, count, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);

    // 过滤掉没有时间戳的记录
    const validLogs = logs.filter(record => record.time);

    // 倒序插入数据（从数组最后一条记录开始插入）
    for (let i = validLogs.length - 1; i >= 0; i--) {
        const record = validLogs[i];
        stmt.run([
            playerId,            // 从 params 中获取 player_id
            record.cardPoolType, // 卡池类型名称
            record.resourceId,   // 资源 ID
            record.qualityLevel, // 物品质量
            record.resourceType, // 资源类型
            record.name,         // 物品名称
            record.count,        // 物品数量
            record.time          // 时间戳
        ]);
    }

    stmt.finalize();
    console.log(`${validLogs.length} 条记录成功插入数据库.`);
    sendStatusToRenderer(event, `${validLogs.cardPoolType}成功更新${validLogs.length}条`);
}

// 根据 player_id 和 card_pool_type 判断是否有记录
async function getLatestTimestampForPlayer(playerId, cardPoolType) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT MAX(timestamp) AS latestTimestamp FROM gacha_logs WHERE player_id = ? AND card_pool_type = ?',
            [playerId, cardPoolType],
            (err, row) => {
                if (err) reject(err);
                resolve(row ? row.latestTimestamp : null);  // 返回最新的时间戳
            }
        );
    });
}

// 插入数据（按倒序插入，且只插入时间戳更新的数据）
async function insertOrUpdateGachaLogs(logs, playerId, event) {
    // 获取每个卡池最新的时间戳
    const groupedLogs = {};
    let newRecordsCount = 0; // 新增记录

    // 按卡池类型和玩家 ID 进行分组
    logs.forEach(record => {
        const key = `${playerId}-${record.cardPoolType}`;
        if (!groupedLogs[key]) {
            groupedLogs[key] = [];
        }
        groupedLogs[key].push(record);
    });

    // 遍历每个卡池类型，检查是否需要插入或更新
    for (const [key, groupedRecords] of Object.entries(groupedLogs)) {
        const [playerId, cardPoolType] = key.split('-');
        const latestTimestamp = await getLatestTimestampForPlayer(playerId, cardPoolType);

        const validRecords = groupedRecords.filter(record => {
            // 如果数据库中没有记录，或者时间戳更晚，则插入新记录
            return !latestTimestamp || new Date(record.time) > new Date(latestTimestamp);
        });

        if (validRecords.length > 0) {
            await insertGachaLogs(validRecords, playerId, event); // 批量插入符合条件的记录
            newRecordsCount += validRecords.length;
        }
    }
    return newRecordsCount;
}

function sendStatusToRenderer(event, message) {
    if (event && event.sender) {
        event.sender.send('gacha-records-status', message);
    } else {
        ipcMain.emit('gacha-records-status', message);
    }
}


module.exports = { parseGachaUrl, fetchAllGachaLogs, GACHA_TYPE_MAP };
