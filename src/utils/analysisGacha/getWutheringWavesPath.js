const { exec } = require('child_process');
const { ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const { db } = require('../../app/database');
const { BrowserWindow, session } = require('electron');

// 注册表路径列表
const registryPaths = [
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_CURRENT_USER\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

// 执行 REG QUERY 命令
function queryRegistryValue(regPath, keyName) {
    return new Promise((resolve, reject) => {
        const command = `reg query "${regPath}" /v ${keyName}`;
        exec(command, { encoding: 'binary' }, (err, stdout, stderr) => {
            if (err || stderr) {
                return reject(`注册表查询失败（${regPath}）: ${iconv.decode(stderr, 'gbk') || err.message}`);
            }

            // 将 stdout 从 GBK 转换为 UTF-8
            const decodedOutput = iconv.decode(Buffer.from(stdout, 'binary'), 'gbk');

            // 提取值
            const match = decodedOutput.match(new RegExp(`${keyName}\\s+REG_SZ\\s+(.+)`));
            if (match) {
                resolve(match[1].trim());
            } else {
                reject(`注册表值（${keyName}）未找到（${regPath}）`);
            }
        });
    });
}

// 从数据库查询路径并验证其有效性
function queryGamePathFromDb() {
    return new Promise((resolve, reject) => {
        const query = "SELECT path FROM games WHERE path LIKE '%Wuthering Waves.exe%'";
        db.get(query, (err, row) => {
            if (err) {
                return reject(`数据库查询失败: ${err.message}`);
            }
            if (row && row.path) {
                const extractedPath = row.path.split('Wuthering Waves.exe')[0].trim();
                const logFilePath = path.join(extractedPath, 'Client', 'Saved', 'Logs', 'Client.log');

                // 验证路径是否存在
                fs.access(logFilePath, fs.constants.F_OK, (accessErr) => {
                    if (accessErr) {
                        return reject(`游戏路径无效，日志文件不存在，请检查（路径: ${logFilePath}）`);
                    }
                    resolve(logFilePath);
                });
            } else {
                reject('非国服官方启动器需要手动录入游戏库，请检查确保添加的是Wuthering Waves.exe。');
            }
        });
    });
}

// 获取游戏路径（优先数据库，其次注册表）
async function getGamePath() {
    const errors = []; // 存储错误信息

    console.log("尝试从数据库中获取鸣潮路径...");
    try {
        // 先尝试从数据库中获取路径
        return await queryGamePathFromDb();
    } catch (dbErr) {
        console.warn("数据库查询鸣潮路径失败，将尝试从注册表中获取路径:", dbErr);
        errors.push(dbErr);
    }

    // 若数据库查询失败，则尝试从注册表中获取路径
    for (const basePath of registryPaths) {
        const fullPath = `${basePath}\\KRInstall Wuthering Waves`;
        console.log(`注册表查询路径: ${fullPath}`);
        try {
            const installPath = await queryRegistryValue(fullPath, 'InstallPath');
            console.log(`找到路径: ${installPath}`);
            return path.join(installPath, 'Wuthering Waves Game', 'Client', 'Saved', 'Logs', 'Client.log');
        } catch (regErr) {
            console.warn(regErr);
            errors.push(regErr);
        }
    }

    // 如果两种方式均失败，则抛出提示错误
    throw new Error(`无法自动定位游戏路径，请在游戏库中手动导入或者更新鸣潮信息（Wuthering Waves.exe）\n失败原因如下:\n- ${errors.join('\n- ')}`);
}

// 读取日志文件并提取祈愿链接
function extractGachaUrl(logFilePath) {
    const tempLogFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'Client_temp.log'); // 使用全局定义的临时路径

    return new Promise((resolve, reject) => {
        // 尝试将日志文件复制到临时目录
        fs.copyFile(logFilePath, tempLogFilePath, (copyErr) => {
            if (copyErr) {
                console.warn(`[本地日志] 复制失败，自动转向云鸣潮获取...`);
                return openCloudGachaFallback(resolve, reject);
            }
            // 从临时文件读取内容
            fs.readFile(tempLogFilePath, 'utf8', (readErr, data) => {
                fs.unlink(tempLogFilePath, (unlinkErr) => {
                    if (unlinkErr) console.warn('删除临时文件失败:', unlinkErr.message);
                });

                if (readErr) {
                    console.warn(`[本地日志] 读取失败，自动转向云鸣潮获取...`);
                    return openCloudGachaFallback(resolve, reject);
                }

                // 使用正则提取符合模式的 URL
                const urlRegex = /https:\/\/aki-gm-resources\.(?:aki-game\.com|oversea\.aki-game\.net)\/aki\/gacha\/index\.html#\/record\?[^ ]+/g;
                const matches = data.match(urlRegex);

                if (matches && matches.length > 0) {
                    let gachaUrl = matches[matches.length - 1]; // 获取最后一个匹配的 URL

                    gachaUrl = gachaUrl.split('"')[0];
                    resolve(gachaUrl); // 成功拿到本地链接，正常返回
                } else {
                    console.warn('[本地日志] 未找到祈愿链接，自动转向云鸣潮获取...');
                    openCloudGachaFallback(resolve, reject);
                }
            });
        });
    });
}

/**
 * 云鸣潮自动化抓包
 */
function openCloudGachaFallback(resolve, reject) {
    const cloudSession = session.fromPartition('cloud_gacha');

    const cloudWin = new BrowserWindow({
        width: 1220,
        height: 750,
        title: '云鸣潮自动获取参数',
        alwaysOnTop: true,
        webPreferences: {
            session: cloudSession,
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    cloudWin.loadURL('https://mc.kurogames.com/cloud/#/');

    cloudWin.webContents.on('did-finish-load', () => {
        const injectNoticeJs = `
            if (!document.getElementById('neko-capture-toast')) {
                const style = document.createElement('style');
                style.innerHTML = \`
                    .neko-toast {
                        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                        background: rgba(30, 31, 36, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                        border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 14px;
                        color: #ffffff; padding: 14px 24px; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4); z-index: 999999;
                        display: flex; align-items: center; gap: 14px; max-width: 550px; animation: nekoFadeIn 0.3s ease;
                    }
                    .neko-toast-icon { font-size: 18px; color: #ff9800; }
                    .neko-toast-content { flex: 1; line-height: 1.5; font-weight: 500; letter-spacing: 0.3px; }
                    .neko-toast-close { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 16px; padding: 0 4px; transition: color 0.2s; }
                    .neko-toast-close:hover { color: #ffffff; }
                    @keyframes nekoFadeIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
                \`;
                document.head.appendChild(style);

                const toast = document.createElement('div');
                toast.id = 'neko-capture-toast';
                toast.className = 'neko-toast';
                toast.innerHTML = \`
                    <span class="neko-toast-icon">💡</span>
                    <div class="neko-toast-content">
                        请先登录库洛账号。登陆成功后(无需开始游戏)，依次点击 <b>[工具] ➔ [唤取记录]</b>。进入页面后应用将自动抓取并关闭此窗口。
                    </div>
                    <button class="neko-toast-close" onclick="this.parentElement.remove()">✕</button>
                \`;
                document.body.appendChild(toast);
            }
        `;
        cloudWin.webContents.executeJavaScript(injectNoticeJs).catch(err => console.error('注入提示失败:', err));
    });

    const filter = { urls: ['https://*/*query*'] };
    cloudSession.webRequest.onBeforeRequest(filter, (details, callback) => {
        if (details.uploadData && details.uploadData.length > 0) {
            try {
                const buffer = details.uploadData[0].bytes;
                if (buffer) {
                    const payload = JSON.parse(buffer.toString('utf8'));

                    if (payload.playerId && payload.cardPoolId) {
                        console.log('成功截获云鸣潮核心参数:', payload);

                        const urlParams = new URLSearchParams();
                        for (const key in payload) {
                            urlParams.append(key, payload[key]);
                        }

                        const reconstructedUrl = `https://aki-gm-resources.aki-game.com/aki/gacha/index.html#/record?${urlParams.toString()}`;

                        cloudSession.webRequest.onBeforeRequest(filter, null);

                        setTimeout(() => {
                            if (!cloudWin.isDestroyed()) cloudWin.close();
                            resolve(reconstructedUrl);
                        }, 600);
                    }
                }
            } catch (e) {
                console.error('解析云游戏载荷失败:', e);
            }
        }
        callback({ cancel: false });
    });

    cloudWin.on('closed', () => {
        reject('未成功获取到唤取参数（操作被取消或未打开唤取记录页面）。');
    });
}

ipcMain.handle('clear-wuwa-url-cache', async () => {
  try {
    const logFilePath = await getGamePath(); // 返回Client.log

    // 日志文件存在：直接高亮
    if (logFilePath && fs.existsSync(logFilePath)) {
      shell.showItemInFolder(logFilePath);
      return {
        success: true,
        message: `已打开鸣潮日志文件位置\n${logFilePath}`,
        path: logFilePath,
      };
    }

    if (logFilePath) {
      const dir = path.dirname(logFilePath);
      if (fs.existsSync(dir)) {
        await shell.openPath(dir);
        return {
          success: false,
          message:
            `未找到日志文件 Client.log，但已打开目录：\n${dir}\n` +
            `请确认游戏已启动并生成日志（Client.log / Client-prev.log）。`,
          path: dir,
        };
      }
    }

    return {
      success: false,
      message: '无法定位鸣潮日志文件，请在游戏库中手动导入/更新 Wuthering Waves.exe 后重试。',
    };
  } catch (error) {
    console.error('[clear-wuwa-url-cache] error:', error);
    return { success: false, message: `操作失败: ${error.message}` };
  }
});


module.exports = { getGamePath, extractGachaUrl };
