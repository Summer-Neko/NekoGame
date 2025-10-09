const { ipcMain, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const GameLogPath = {
    CN: path.join('miHoYo', '崩坏：星穹铁道'),
    GLOBAL: path.join('Cognosphere', 'Star Rail')
};

function getGameLogPath() {
    const basePath = path.join(os.homedir(), 'AppData', 'LocalLow');
    const candidatePaths = [
        path.join(basePath, GameLogPath.CN),
        path.join(basePath, GameLogPath.GLOBAL),
    ];

    for (const candidate of candidatePaths) {
        const logFile = path.join(candidate, 'Player.log');
        if (fs.existsSync(logFile)) {
            return logFile;
        }
    }
    return null;
}

function getGameInstallPath() {
    const logPath = getGameLogPath();
    if (!logPath) return null;

    const logFiles = [logPath, logPath.replace('Player.log', 'Player-prev.log')];
    for (const file of logFiles) {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf-8');
            const match = content.match(/Loading player data from (.+?)data\.unity3d/);
            if (match) {
                return match[1].trim();
            }
        }
    }
    return null;
}

function getLatestCachePath(gamePath) {
    const cacheBasePath = path.join(gamePath, 'webCaches');
    if (!fs.existsSync(cacheBasePath)) return null;
    const folders = fs.readdirSync(cacheBasePath).filter((folder) =>
        /^\d+\.\d+\.\d+\.\d+$/.test(folder)
    );
    let latestCachePath = null;
    let maxVersion = 0;
    folders.forEach((folder) => {
        const version = parseInt(folder.split('.').join(''), 10);
        if (version > maxVersion) {
            maxVersion = version;
            latestCachePath = path.join(cacheBasePath, folder, 'Cache', 'Cache_Data', 'data_2');
        }
    });
    return latestCachePath;
}

function extractGachaLogUrl(cachePath) {
    if (!fs.existsSync(cachePath)) return null;
    const cacheData = fs.readFileSync(cachePath, 'latin1');
    const entries = cacheData.split('1/0/');
    const urlRegex = /https:\/\/.+?&auth_appid=webview_gacha&.+?authkey=.+?&game_biz=hkrpg_(?:cn|global)/;

    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        const match = entry.match(urlRegex);
        if (match) {
            return match[0];
        }
    }
    return null;
}

// 简化url，暂不使用
// function simplifyUrl(rawUrl) {
//     const parsed = url.parse(rawUrl, true);
//     const allowedKeys = ['authkey', 'authkey_ver', 'sign_type', 'game_biz', 'lang'];
//     const filteredQuery = Object.keys(parsed.query)
//         .filter((key) => allowedKeys.includes(key))
//         .reduce((obj, key) => {
//             obj[key] = parsed.query[key];
//             return obj;
//         }, {});
//     return `${parsed.protocol}//${parsed.host}${parsed.pathname}?${new url.URLSearchParams(filteredQuery)}`;
// }

// 添加 IPC 接口
ipcMain.handle('getStarRailUrl', async () => {
    return getStarRailLink();
});


function getStarRailLink() {
    const gamePath = getGameInstallPath();
    if (!gamePath) return { success: false, message: '未找到日志文件，请启动过游戏后再尝试。' };
    const cachePath = getLatestCachePath(gamePath);
    if (!cachePath) return { success: false, message: '未找到缓存文件，请确保你下载了这款游戏。' };
    const gachaUrl = extractGachaLogUrl(cachePath);
    if (!gachaUrl) return { success: false, message: '未找到抽卡记录链接。' };
    clipboard.writeText(gachaUrl);
    return { success: true, message: `星铁抽卡链接获取成功，已复制到剪贴板。\n${gachaUrl}` };
}

module.exports = { getStarRailLink };
