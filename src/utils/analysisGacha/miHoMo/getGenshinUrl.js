const { ipcMain, clipboard,shell } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 动态获取日志路径
function getLogPath() {
    const basePath = path.join(process.env.USERPROFILE, 'AppData', 'LocalLow', 'miHoYo');
    const globalPath = path.join(basePath, 'Genshin Impact', 'output_log.txt');
    const chinaPath = path.join(basePath, '原神', 'output_log.txt');

    if (fs.existsSync(globalPath)) return globalPath;
    if (fs.existsSync(chinaPath)) return chinaPath;

    return null;
}

// 从日志文件中解析游戏路径
function extractGameDir(logContent) {
    const match = logContent.match(/([A-Z]:\\.+?\\(GenshinImpact_Data|YuanShen_Data))/);
    if (match) {
        return match[1];
    }
    return null;
}

// 动态获取最新缓存文件夹
function getLatestCacheVersion(gameDir) {
    const webCachesPath = path.join(gameDir, 'webCaches');
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
    const urlRegex = /https:\/\/.+?&auth_appid=webview_gacha&.+?authkey=.+?&game_biz=hk4e_(?:cn|global|os)/;

    for (let i = entries.length - 1; i >= 0; i--) {
        const match = entries[i].match(urlRegex);
        if (match) {
            return match[0];
        }
    }
    return null;
}


// IPC 接口
ipcMain.handle('getGenshinWishLink', async () => {
    return await getGenshinWishUrl();
});

async function getGenshinWishUrl() {
    const logPath = getLogPath();
    if (!logPath) {
        return { success: false, message: '未找到原神日志文件，请确认游戏是否启动过。' };
    }

    try {
        const logContent = fs.readFileSync(logPath, 'utf-8');
        const gameDir = extractGameDir(logContent);
        if (!gameDir) {
            return { success: false, message: '无法解析游戏路径，请确保日志文件完整。或前往项目地址反馈信息' };
        }

        const cacheVersion = getLatestCacheVersion(gameDir); // 获取最新的缓存文件夹
        const cacheFilePath = path.join(gameDir, 'webCaches', cacheVersion, 'Cache', 'Cache_Data', 'data_2');
        if (!fs.existsSync(cacheFilePath)) {
            return { success: false, message: `未找到缓存文件，请确保游戏已启动并生成缓存 :${cacheFilePath}。` };
        }

        const wishLink = extractGachaLogUrl(cacheFilePath);
        if (!wishLink) {
            return { success: false, message: '未找到祈愿记录链接，请确保您已打开祈愿记录页面。' };
        }

        clipboard.writeText(wishLink);
        return { success: true, message: `祈愿记录链接已复制到剪贴板！\n${wishLink}` };
    } catch (error) {
        console.error('获取祈愿纪录失败:', error.message);
        return { success: false, message: `操作失败: ${error.message}` };
    }
}

function getGenshinCacheFilePath() {
  const logPath = getLogPath();
  if (!logPath) {
    return { success: false, message: '未找到原神日志文件，请确认游戏是否启动过。' };
  }

  const logContent = fs.readFileSync(logPath, 'utf-8');
  const gameDir = extractGameDir(logContent);
  if (!gameDir) {
    return { success: false, message: '无法解析游戏路径，请确保日志文件完整。' };
  }

  const cacheVersion = getLatestCacheVersion(gameDir);
  const cacheFilePath = path.join(
    gameDir,
    'webCaches',
    cacheVersion,
    'Cache',
    'Cache_Data',
    'data_2'
  );

  return { success: true, gameDir, cacheVersion, cacheFilePath };
}

/**
 * 打开缓存文件所在目录并高亮 data_2
 */
ipcMain.handle('clear-genshin-url-cache', async () => {
  try {
    const info = getGenshinCacheFilePath();
    if (!info.success) return info;

    const { cacheFilePath } = info;

    if (fs.existsSync(cacheFilePath)) {
      // 打开资源管理器并高亮该文件
      shell.showItemInFolder(cacheFilePath);
      return {
        success: true,
        message: `已打开缓存文件位置\n${cacheFilePath}`,
        path: cacheFilePath,
      };
    } else {
      // 文件不存在：至少打开目录（避免 showItemInFolder 无效）
      const dir = path.dirname(cacheFilePath);
      if (fs.existsSync(dir)) {
        await shell.openPath(dir);
        return {
          success: false,
          message: `未找到缓存文件 data_2，但已打开目录：\n${dir}\n请确认游戏已启动并打开过祈愿页面。`,
          path: dir,
        };
      }

      return {
        success: false,
        message: `未找到缓存目录：\n${dir}\n请确认游戏已启动过。`,
      };
    }
  } catch (error) {
    console.error('[clear-genshin-url-cache] error:', error);
    return { success: false, message: `操作失败: ${error.message}` };
  }
});

module.exports = { getGenshinWishUrl };
