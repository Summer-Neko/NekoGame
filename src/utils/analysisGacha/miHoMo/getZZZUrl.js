const { ipcMain, clipboard,shell } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const {db} = require("../../../app/database");

// 改成从数据库中获取路径
function queryGamePathFromDb() {
    return new Promise((resolve, reject) => {
        try {
            const query = "SELECT path FROM games WHERE path LIKE '%ZenlessZoneZero.exe%'";
            db.get(query, (err, row) => {
                if (err) {
                    global.Notify(false, `数据库查询失败: ${err.message}`)
                    return reject(`数据库查询失败: ${err.message}`);
                }
                if (row && row.path) {
                    const extractedPath = row.path.split('ZenlessZoneZero.exe')[0].trim();
                    // 验证路径是否存在
                    fs.access(extractedPath, fs.constants.F_OK, (accessErr) => {
                        if (accessErr) {
                            return reject(`游戏路径无效，请检查（路径: ${extractedPath}）`);
                        }
                        resolve(extractedPath);
                    });
                } else {
                    global.Notify(false, 'ZZZ需要手动录入游戏库，\n请检查确保添加的是ZenlessZoneZero.exe');
                    reject('绝区零需要手动录入游戏库，请检查确保添加的是ZenlessZoneZero.exe');
                }
            });
        }catch (e){
            global.Notify(false, '出现了问题\nZZZ需要手动录入游戏库\n请检查确保添加的是ZenlessZoneZero.exe');
            console.error(`绝区零数据查询出现问题: ${e.message}`)
            reject('绝区零需要手动录入游戏库，请检查确保添加的是ZenlessZoneZero.exe');
        }
    });
}

// 动态获取缓存文件夹版本
function getLatestCacheVersion(gameDir) {
    const webCachesPath = path.join(gameDir,'ZenlessZoneZero_Data', 'webCaches');
    if (!fs.existsSync(webCachesPath)) {
        throw new Error('未找到 webCaches 目录，请确认游戏是否启动过。');
    }
    const subdirs = fs
        .readdirSync(webCachesPath, { withFileTypes: true })
        .filter((dir) => dir.isDirectory())
        .map((dir) => ({
            name: dir.name,
            time: fs.statSync(path.join(webCachesPath, dir.name)).mtimeMs
        }))
        .sort((a, b) => b.time - a.time); // 按修改时间从新到旧排序

    if (subdirs.length === 0) {
        throw new Error('webCaches 目录中未找到任何版本文件夹。');
    }

    return subdirs[0].name; // 返回最新文件夹的名称
}


// 从缓存文件中提取祈愿记录链接
function extractGachaLogUrl(cachePath) {
    if (!fs.existsSync(cachePath)) {
        throw new Error('缓存文件不存在，请确认游戏已经启动过。');
    }
    const cacheData = fs.readFileSync(cachePath, 'latin1');
    const entries = cacheData.split('1/0/');
    const urlRegex = /https:\/\/.+?&auth_appid=webview_gacha&.+?authkey=.+?&game_biz=nap_(?:cn|global)/;

    for (let i = entries.length - 1; i >= 0; i--) {
        const match = entries[i].match(urlRegex);
        if (match) {
            return match[0];
        }
    }
    return null;
}


// IPC 接口
ipcMain.handle('getZZZLink', async () => {
    return await getZZZUrl();
});

async function getZZZUrl(){
    try {
        const gameDir = await queryGamePathFromDb();
        if (!gameDir) {
            return { success: false, message: '无法获取游戏路径，绝区零暂时不支持动态获取，需要先导入游戏\n游戏名: ZenlessZoneZero.exe' };
        }
        const cacheVersion = getLatestCacheVersion(gameDir);  // 获取缓存文件夹版本
        const cacheFilePath = path.join(gameDir, 'ZenlessZoneZero_Data','webCaches', cacheVersion, 'Cache', 'Cache_Data', 'data_2');
        if (!fs.existsSync(cacheFilePath)) {
            return { success: false, message: `未找到缓存文件夹，请确保游戏已启动并生成缓存 :${cacheFilePath}。` };
        }
        const wishLink = extractGachaLogUrl(cacheFilePath);
        if (!wishLink) {
            return { success: false, message: '未找到调频记录链接，请确保您已打开调频记录页面。' };
        }
        clipboard.writeText(wishLink);
        return { success: true, message: `抽卡链接已复制到剪贴板！\n${wishLink}` };
    } catch (error) {
        console.error(`绝区零获取祈愿纪录失败:, ${error.message}`);
        return { success: false, message: `绝区零获取祈愿纪录失败\n错误信息: ${error.message}` };
    }
}

async function getZZZCacheFileInfo() {
  const gameDir = await queryGamePathFromDb(); // 例如 D:\Games\ZZZ\
  const cacheVersion = getLatestCacheVersion(gameDir);

  const cacheFilePath = path.join(
    gameDir,
    'ZenlessZoneZero_Data',
    'webCaches',
    cacheVersion,
    'Cache',
    'Cache_Data',
    'data_2'
  );

  return { gameDir, cacheVersion, cacheFilePath };
}

/**
 * 打开缓存文件所在目录并高亮 data_2
 */
ipcMain.handle('clear-zzz-url-cache', async () => {
  try {
    const { cacheFilePath } = await getZZZCacheFileInfo();

    if (fs.existsSync(cacheFilePath)) {
      shell.showItemInFolder(cacheFilePath);
      return {
        success: true,
        message: `已打开并高亮缓存文件（data_2）\n${cacheFilePath}`,
        path: cacheFilePath
      };
    }

    // 文件不存在：尽量打开 Cache_Data 目录或上级目录
    const cacheDataDir = path.dirname(cacheFilePath); // .../Cache_Data
    const cacheDir = path.dirname(cacheDataDir);      // .../Cache

    if (fs.existsSync(cacheDataDir)) {
      await shell.openPath(cacheDataDir);
      return {
        success: false,
        message:
          `未找到缓存文件 data_2，但已打开目录：\n${cacheDataDir}\n` +
          `请确认：已启动游戏并打开过【调频/抽卡记录】页面后再试。`,
        path: cacheDataDir
      };
    }

    if (fs.existsSync(cacheDir)) {
      await shell.openPath(cacheDir);
      return {
        success: false,
        message:
          `未找到 Cache_Data 目录，但已打开目录：\n${cacheDir}\n` +
          `请确认：已启动游戏并打开过【调频/抽卡记录】页面后再试。`,
        path: cacheDir
      };
    }

    return {
      success: false,
      message: `未找到缓存目录：\n${cacheDir}\n请确认游戏是否启动过。`
    };
  } catch (error) {
    console.error('[clear-zzz-url-cache] error:', error);
    return { success: false, message: `操作失败: ${error.message}` };
  }
});

module.exports = { getZZZUrl }
