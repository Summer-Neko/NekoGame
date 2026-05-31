const { URL, URLSearchParams } = require('url');
const { get } = require('axios');

async function fetchGachaRecords(allRecords, GACHA_TYPE_MAP, gachaUrl, event) {

    const size = 20;
    let totalFetched = 0;
    const parsedUrl = new URL(gachaUrl);

    for (const [gachaType, gachaName] of Object.entries(GACHA_TYPE_MAP)) {
        console.log(`正在获取 ${gachaName} 的祈愿记录...`);
        let page = 1;
        let endId = '0';
        let retries = 0;

        while (retries < 3) {
            try {
                const queryParams = new URLSearchParams(parsedUrl.search);
                queryParams.set("gacha_type", gachaType);
                queryParams.set("page", page.toString());
                queryParams.set("size", size.toString());
                queryParams.set("end_id", endId);

                // 动态选择接口路径
                let endpointPath = parsedUrl.pathname;
                if (['21', '22'].includes(gachaType)) {
                    endpointPath = '/common/gacha_record/api/getLdGachaLog';
                }

                const urlWithParams = `${parsedUrl.origin}${endpointPath}?${queryParams.toString()}`;

                const response = await get(urlWithParams);
                const data = response.data;

                console.log(`获取 ${gachaName} 第 ${page} 页数据...`);
                event.sender.send('gacha-records-status', `获取 ${gachaName} 第 ${page} 页数据...`);

                // 1. 处理接口报错
                if (data.retcode !== 0) {
                    console.error(`获取 ${gachaName} 第 ${page} 页数据失败: ${data.message || '未知错误'}`);
                    retries++;
                    if (retries >= 3) break;
                    await new Promise(resolve => setTimeout(resolve, 300));
                    continue;
                }

                // 遇到空数据才判定为全部获取完毕！
                if (!data.data || !data.data.list || data.data.list.length === 0) {
                    console.log(`${gachaName} 数据已全部获取完毕。`);
                    break; // 数据抽干了，直接跳出 while，开始获取下一个卡池
                }

                // 3. 正常拼接数据
                const fetchedRecords = data.data.list;
                allRecords[gachaType] = allRecords[gachaType].concat(fetchedRecords);
                totalFetched += fetchedRecords.length;

                // 更新 end_id，供下一页查询使用
                endId = fetchedRecords[fetchedRecords.length - 1].id;

                // 重置重试次数
                retries = 0;

                // 准备翻到下一页
                await new Promise(resolve => setTimeout(resolve, 300));
                page++;

            } catch (err) {
                console.error(`请求 ${gachaName} 第 ${page} 页失败:`, err);
                retries++;
                if (retries >= 3) break;
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
    }
    return totalFetched;
}

module.exports = { fetchGachaRecords };
