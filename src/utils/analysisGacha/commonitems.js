const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

// 获取数据路径
const dataPath = process.env.NEKO_GAME_FOLDER_PATH;
const commonItemsFile = path.join(dataPath, 'commonItems.json');

// 定义初始数据
const defaultCommonItems = {
    version: 1,
    starRail: {
        "zh-cn": [
            "布洛妮娅", "瓦尔特", "克拉拉", "杰帕德", "姬子", "白露", "彦卿",
            "时节不居", "但战斗还未结束", "制胜的瞬间", "如泥酣眠", "银河铁道之夜", "无可取代的东西", "以世界之名",
            { "name": "希儿", "addedTime": "2025-04-09 06:00:00" },
            { "name": "符玄", "addedTime": "2025-04-09 06:00:00" },
            { "name": "刃", "addedTime": "2025-04-09 06:00:00" },
            { "name": "云璃", "addedTime": "2026-04-22 06:00:00" },
            { "name": "银枝", "addedTime": "2026-04-22 06:00:00" },
            { "name": "银狼", "addedTime": "2026-04-22 06:00:00" }
        ],
        "zh-tw": [
            "布洛妮婭", "瓦爾特", "克拉拉", "傑帕德", "姬子", "白露", "彥卿",
            "時節不居", "但戰鬥還未結束", "制勝的瞬間", "如泥酣眠", "銀河鐵道之夜", "無可取代的東西", "以世界之名",
            { "name": "希兒", "addedTime": "2025-04-09 06:00:00" },
            { "name": "符玄", "addedTime": "2025-04-09 06:00:00" },
            { "name": "刃", "addedTime": "2025-04-09 06:00:00" },
            { "name": "雲璃", "addedTime": "2026-04-22 06:00:00" },
            { "name": "銀枝", "addedTime": "2026-04-22 06:00:00" },
            {"name": "銀狼", "addedTime": "2026-04-22 06:00:00" }
        ]
    },
    genshin: {
        "zh-cn": [
            "琴", "迪卢克", "七七", "莫娜", "刻晴",
            "天空之脊", "和璞鸢", "四风原典", "天空之卷", "天空之翼", "阿莫斯之弓",
            "狼的末路", "天空之傲", "天空之刃", "风鹰剑",
            { "name": "提纳里", "addedTime": "2022-08-24 06:00:00" },
            { "name": "迪希雅", "addedTime": "2023-03-02 06:00:00" },
            { "name": "梦见月瑞希", "addedTime": "2025-02-12 06:00:00" },
        ],
        "zh-tw": [
            "琴", "迪盧克", "七七", "莫娜", "刻晴",
            "天空之脊", "和璞鴻", "四風原典", "天空之卷", "天空之翼", "阿莫斯之弓",
            "狼的末路", "天空之傲", "天空之刃", "風鷹劍",
            { "name": "提納里", "addedTime": "2022-08-24 06:00:00" },
            { "name": "迪希雅", "addedTime": "2023-03-02 06:00:00" },
            { "name": "夢見月瑞希", "addedTime": "2025-02-12 06:00:00" },
        ]
    },
    wuWa: {
        "zh-cn": [
            "安可", "卡卡罗", "凌阳", "鉴心", "维里奈",
            "千古洑流", "浩境粼光", "停驻之烟", "擎渊怒涛", "漪澜浮录"
        ],
        "zh-tw": [
            "安可", "卡卡羅", "凌陽", "鑑心", "維里奈",
            "千古洑流", "浩境粼光", "停駐之煙", "擎淵怒濤", "漪瀾浮錄"
        ]
    },
    zzz: {
        "zh-cn": [
            "「11号」", "猫又", "格莉丝", "珂蕾妲", "莱卡恩", "丽娜",
            "钢铁肉垫", "硫磺石", "拘缚者", "燃狱齿轮", "啜泣摇篮", "嵌合编译器"
        ],
        "zh-tw": [
            "「11號」", "貓又", "格莉絲", "珂蕾妲", "萊卡恩", "麗娜",
            "鋼鐵肉墊", "硫磺石", "拘束者", "燃獄齒輪", "啜泣搖籃", "嵌合編譯器"
        ]
    }
};

async function initializeCommonItems() {
    try {
        if (!fs.existsSync(commonItemsFile)) {
            await fs.promises.writeFile(commonItemsFile, JSON.stringify(defaultCommonItems, null, 2), 'utf8');
            console.log('commonItems.json 文件已创建');
        } else {
            const data = await fs.promises.readFile(commonItemsFile, 'utf8');
            const parsedData = JSON.parse(data);

            // 如果旧文件没有 version 字段，或者版本号低于最新默认值，执行覆盖
            if (!parsedData.version || parsedData.version < defaultCommonItems.version) {
                await fs.promises.writeFile(commonItemsFile, JSON.stringify(defaultCommonItems, null, 2), 'utf8');
                console.log(`commonItems.json 已更新至版本 ${defaultCommonItems.version}`);
            }
        }
    } catch (error) {
        console.error('初始化/更新 commonItems 文件失败:', error);
    }
}

initializeCommonItems();

async function loadOrCreateCommonItems() {
    try {
        if (!fs.existsSync(commonItemsFile)) {
            await fs.promises.writeFile(commonItemsFile, JSON.stringify(defaultCommonItems, null, 2), 'utf8');
            console.log('commonItems.json 文件已创建');
            return defaultCommonItems;
        } else {
            const data = await fs.promises.readFile(commonItemsFile, 'utf8');
            const parsedData = JSON.parse(data);

            // 【新增】读取时再次兜底检查，防止读取到过期的本地数据
            if (!parsedData.version || parsedData.version < defaultCommonItems.version) {
                await fs.promises.writeFile(commonItemsFile, JSON.stringify(defaultCommonItems, null, 2), 'utf8');
                console.log(`检测到旧版常驻数据，已更新至版本 ${defaultCommonItems.version}`);
                return defaultCommonItems;
            }

            return parsedData;
        }
    } catch (error) {
        console.error('加载或创建 commonItems 文件失败:', error);
        return defaultCommonItems;
    }
}

ipcMain.handle('get-common-items', async (event, game, lang) => {
  const commonItemsData = await loadOrCreateCommonItems();
  console.log(`传入的常驻记录游戏是 ${game}, 语言版本是 ${lang}`);

  const gameData = commonItemsData[game] || {};
  return gameData[lang] || gameData['zh-cn'] || [];
});
