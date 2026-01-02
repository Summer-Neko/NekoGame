const { db2 } = require('../../../app/database');
const { get } = require("axios");
const db = db2;
const {fetchGachaRecords} = require("./fetchGacha");
const {getZZZUrl} = require("./getZZZUrl");

// 定义祈愿类型映射
const GACHA_TYPE_MAP = {
    "2001": "独家频段",
    "3001": "音擎频段",
    "1001": "常驻频段",
    "5001": "邦布频段"
};

async function insertGachaLogs(logs) {
    let insertedCount = 0;
    const insertPromises = logs.map(log => {
        return new Promise((resolve, reject) => {
            const { id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type } = log;
            db.run(`INSERT OR IGNORE INTO zzz_gacha (id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, uid, gacha_id, gacha_type, item_id, count, time, name, lang, item_type, rank_type], function (err) {
                        if (err) {
                            reject(`插入失败: ${err.message}`);
                        } else {
                            if (this.changes > 0) {
                                insertedCount++;
                            }
                            resolve();
                        }
                    });
        });
    });
    // 等待所有插入操作完成
    await Promise.all(insertPromises);
    console.log(`成功插入 ${insertedCount} 条数据`);
    return insertedCount;
}


async function fetchZzzGachaData(event) {
    // 获取抽卡记录链接
    const result = await getZZZUrl();
    console.log(JSON.stringify(result));
    if (!result.success) {
        console.error(result.message);
        return {success: result.success, message:result.message};
    }

    const gachaUrl = result.message.split('\n')[1].trim();
    console.log(`获取的抽卡记录链接: ${gachaUrl}`);
    global.Notify(true, `已获取抽卡记录并复制到剪贴板\n${gachaUrl}`);
    // 获取祈愿日志数据
    try {
        const allRecords = { '2001': [], '3001': [], '1001': [], '5001': [] };
        let totalFetched = await fetchZzzGachaRecords(allRecords,GACHA_TYPE_MAP,gachaUrl,event);
        // 插入查询到的所有数据
        const totalInserted = await insertGachaLogs(allRecords['2001'].concat(allRecords['3001'], allRecords['1001'], allRecords['5001']));
        event.sender.send('gacha-records-status', `查询到的抽卡记录: ${totalFetched} 条,成功插入: ${totalInserted} 条`);
        return { success: true, message: `查询到的抽卡记录: ${totalFetched} 条\n成功插入: ${totalInserted} 条`};
    } catch (error) {
        console.error('获取抽卡数据时出错:', error);
        event.sender.send('gacha-records-status', `获取抽卡数据时出错:${error}`);
        return { success: false, message: `获取抽卡数据时出错\n${error}`};
    }
}

async function fetchZzzGachaRecords(allRecords, GACHA_TYPE_MAP, gachaUrl, event) {
    const REQUEST_SIZE = 20;
    const MAX_EMPTY_PAGE = 2;  // 连续空页保护
    const parsedUrl = new URL(gachaUrl);

    let totalFetched = 0;

    for (const [gachaType, gachaName] of Object.entries(GACHA_TYPE_MAP)) {
        console.log(`正在获取 ${gachaName} 的祈愿记录...`);
        event.sender.send('gacha-records-status', `正在获取 ${gachaName} 的祈愿记录...`);
        let page = 1;
        let endId = '0';
        let emptyPageCount = 0;

        while (true) {
            try {
                const queryParams = new URLSearchParams(parsedUrl.search);
                queryParams.set('gacha_type', gachaType);
                queryParams.set('page', page.toString());   // page 只是占位
                queryParams.set('size', REQUEST_SIZE.toString());
                queryParams.set('end_id', endId);

                const urlWithParams =
                    `${parsedUrl.origin}${parsedUrl.pathname}?${queryParams.toString()}`;

                console.log(`获取 ${gachaName} 第 ${page} 页数据...`);
                event.sender.send(
                    'gacha-records-status',
                    `获取 ${gachaName} 第 ${page} 页数据...`
                );
                const response = await get(urlWithParams);
                const data = response.data;

                console.log('回应数据', JSON.stringify(data));

                // === 基本合法性检查 ===
                if (
                    data.retcode !== 0 ||
                    !data.data ||
                    !Array.isArray(data.data.list)
                ) {
                    console.warn(`获取 ${gachaName} 第 ${page} 页返回异常，停止该池`);
                    break;
                }

                const list = data.data.list;

                // === 空页处理 ===
                if (list.length === 0) {
                    emptyPageCount++;
                    if (emptyPageCount >= MAX_EMPTY_PAGE) {
                        console.log(`${gachaName} 连续空页，停止`);
                        break;
                    }
                    await sleep(300);
                    page++;
                    continue;
                }

                emptyPageCount = 0;

                // === 保存数据 ===
                allRecords[gachaType].push(...list);
                totalFetched += list.length;

                const lastId = list[list.length - 1].id;

                // === end_id 防死循环 ===
                if (!lastId || lastId === endId) {
                    console.warn(`${gachaName} end_id 未变化，停止翻页`);
                    break;
                }
                endId = lastId;
                page++;
                await sleep(300);
            } catch (err) {
                console.error(`请求 ${gachaName} 第 ${page} 页失败:`, err);
                break;
            }
        }
    }

    return totalFetched;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { fetchZzzGachaData }
