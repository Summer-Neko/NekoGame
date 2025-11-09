const { BrowserWindow, ipcMain, shell} = require('electron');
const { saveSyncConfigToFile, loadSyncConfigFromFile } = require('./syncSettings');
const path = require("path");
const {get, put} = require("axios");  // 引入获取设置的函数
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

let dataSyncWindow = null;
function createDataSyncWindow() {
    if (dataSyncWindow) {
        return;
    }
    dataSyncWindow = new BrowserWindow({
        width: 500,
        height: 400,
        resizable: false,
        parent: mainWindow,
        modal: true,
        show: false,
        backgroundColor: 'rgba(60,60,60,0.64)',
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true, // 开启上下文隔离
            preload: path.join(__dirname, '../../preload.js')
        }
    });
    // 加载数据同步窗口的 HTML 页面
    dataSyncWindow.loadFile('./src/pages/modalPages/dataSyncWindow.html');
    // 窗口加载完毕后显示
    dataSyncWindow.once('ready-to-show', () => {
        dataSyncWindow.show();
    });
    dataSyncWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // 拦截导航事件，阻止内部导航并改为默认浏览器打开
    dataSyncWindow.webContents.on('will-navigate', (event, url) => {
        if (url !== guideWindow.webContents.getURL()) {
            event.preventDefault(); // 阻止导航
            shell.openExternal(url); // 在默认浏览器中打开链接
        }
    });
    // 关闭窗口时清理引用
    dataSyncWindow.on('closed', () => {
        dataSyncWindow.destroy();
        dataSyncWindow = null;
    });
}
// 监听前端发送的 'openDataSyncWindow' 事件，创建数据同步窗口
ipcMain.on('openDataSyncWindow', () => {
    createDataSyncWindow();
});

// 监听前端发送的 'saveSyncSettings' 事件，保存同步设置
ipcMain.on('saveSyncSettings', (event, { repoUrl, token }) => {
    try {
        // 保存加密配置信息到文件
        saveSyncConfigToFile(repoUrl, token);
        event.reply('syncSettingsStatus', { success: true, message: '同步设置已成功更新并已经上传数据、之后每次启动应用后会自动同步数据' });
    } catch (error) {
        console.error('保存设置失败:', error);
        event.reply('syncSettingsStatus', { success: false, message: `保存失败: ${error.message}` });
    }
});
ipcMain.on('uploadFirstData', async (event) => {
    try {
        await initUpload();  // 确保上传过程是异步执行并等待完成
        event.reply('syncSettingsStatus', { success: true, message: '数据上传成功' });
    } catch (error) {
        console.error('初始化数据失败:', error);
        event.reply('syncSettingsStatus', { success: false, message: `同步失败: ${error.message}` });
    }
});

ipcMain.on('downloadLastedData', async (event, { repoUrl, token }) => {
    try {
        const neko_gameFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'neko_game.db');
        const gacha_dataFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'gacha_data.db');

        await downloadFileFromRepo(repoUrl, token, 'neko_game.db', neko_gameFilePath);
        await downloadFileFromRepo(repoUrl, token, 'gacha_data.db', gacha_dataFilePath);

        event.reply('syncSettingsStatus', { success: true, message: '数据下载成功' });
    } catch (error) {
        console.error('下载失败:', error);
        event.reply('syncSettingsStatus', { success: false, message: `下载失败: ${error.message}` });
    }
});


// 监听关闭数据同步窗口的事件
ipcMain.on('closeDataSyncWindow', () => {
    if (dataSyncWindow) {
        dataSyncWindow.close();  // 关闭数据同步窗口
    }
});

// 获取当前文件的时间戳
function getFileTimestamp(filePath) {
    // 本地文件一定存在时，可直接读取
    try {
        const stats = fs.statSync(filePath);
        return Math.floor(stats.mtime.getTime() / 1000) * 1000;  // 转换为毫秒级时间戳
    } catch (e) {
        console.warn(`无法获取文件时间戳: ${filePath}`, e.message);
        return null;
    }
}


// 获取文件的时间戳
async function getFileTimestampFromRepo(repoUrl, token, fileName) {
    const { owner, repo, platform } = parseRepoUrl(repoUrl);
    // console.log('owner,repo,platform', owner, repo, platform);

    let apiUrl, commitResponse;
    if (platform === 'gitee') {
        // 确保路径和分支名正确
        apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/commits?path=NekoGame/${fileName}`;
    } else if (platform === 'github') {
        apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=NekoGame/${fileName}`;
    } else {
        throw new Error('不支持的仓库平台');
    }
    try {
        // 设置请求头
        let headers = {};
        if (platform === 'github') {
            headers['Authorization'] = `token ${token}`;  // GitHub 的 token 使用 Authorization 头
        }
        let params = {};
        if (platform === 'gitee') {
            params.access_token = token;  // Gitee 使用查询参数传递 token
        }
        commitResponse = await axios.get(apiUrl, { headers: headers, params: params });
        console.log('apiUrl', apiUrl);
        // console.log('commitResponse信息', JSON.stringify(commitResponse.data));

        if (commitResponse.data && commitResponse.data.length > 0) {
            const commitDate = commitResponse.data[0].commit.committer.date;
            console.log('文件最新提交时间戳:', commitDate);
            return new Date(commitDate).getTime();  // 返回最新提交的时间戳
        } else {
            console.error('没有找到文件的提交记录');
            return null;
        }
    } catch (error) {
        console.error('获取文件时间戳失败:', error);
        return null;
    }
}


// 解析 仓库的 URL，获取 owner 和 repo
function parseRepoUrl(repoUrl) {
    const giteeRegex = /https:\/\/gitee\.com\/([^\/]+)\/([^\/]+)/;
    const githubRegex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)/;
    let matches;

    if ((matches = repoUrl.match(giteeRegex))) {
        return {
            owner: matches[1],
            repo: matches[2],
            platform: 'gitee'
        };
    } else if ((matches = repoUrl.match(githubRegex))) {
        return {
            owner: matches[1],
            repo: matches[2],
            platform: 'github'
        };
    } else {
        throw new Error('无效的仓库 URL');
    }
}

// 检查文件是否已存在于仓库中
async function checkFileExists(repoUrl, token, fileName, platform) {
    const { owner, repo } = parseRepoUrl(repoUrl);
    let apiUrl;

    if (platform === 'gitee') {
        // Gitee API 请求，使用 access_token 作为 URL 参数
        apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
    } else if (platform === 'github') {
        // GitHub API 请求，使用 Authorization header 传递 token
        apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
    } else {
        throw new Error('不支持的仓库平台');
    }

    try {
        const headers = platform === 'github' ? {
            'Authorization': `Bearer ${token}` // 使用 Bearer token 进行身份验证
        } : {}; // 对于 Gitee，不需要额外的 headers

        const response = await axios.get(apiUrl, {
            params: platform === 'gitee' ? { access_token: token } : {}, // 对于 Gitee 使用 access_token 作为 URL 参数
            headers: headers
        });

        // 返回文件的 SHA 值
        return response.data.sha;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // 文件不存在
        }
        throw error; // 其他错误
    }
}


// 上传文件到仓库
async function uploadFileToRepo(repoUrl, token, filePath, fileName) {
    let platformMessage = '';
    const maxRetries = 3; // 最大重试次数
    let retries = 0;

    try {
        const { owner, repo, platform } = parseRepoUrl(repoUrl);
        platformMessage = platform;

        const fileContent = fs.readFileSync(filePath);
        const base64Content = fileContent.toString('base64');

        let apiUrl;
        if (platform === 'gitee') {
            apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
        } else if (platform === 'github') {
            apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
        } else {
            throw new Error('不支持的仓库平台');
        }

        // 检查文件是否存在，存在返回 sha，不存在返回 null
        const existingSha = await checkFileExists(repoUrl, token, fileName, platform);

        // 统一先 PUT
        const data = existingSha
          ? { message: 'NekoGame数据文件', content: base64Content, sha: existingSha }
          : { message: 'NekoGame数据文件', content: base64Content };

        try {
            const response = await axios.put(apiUrl, data, {
                headers: platform === 'github' ? { Authorization: `Bearer ${token}` } : {},
                params: platform === 'gitee' ? { access_token: token } : {}
            });
            console.log(fileName, '更新/创建成功 (PUT)', response.data?.commit?.message || '');
            return;
        } catch (putErr) {
            // GitHub: 不支持 /contents 的 POST 创建，直接抛错
            if (platform !== 'gitee') throw putErr;

            const postData = { message: 'NekoGame数据文件', content: base64Content };
            console.log(`尝试上传文件 (POST): ${fileName}`);
            while (retries < maxRetries) {
                try {
                    const response = await axios.post(apiUrl, postData, {
                        headers: {},
                        params: { access_token: token }
                    });
                    console.log(fileName, '上传成功 (POST)', response.data?.commit?.message || '');
                    return;
                } catch (postErr) {
                    retries++;
                    console.error(`POST 上传失败 (尝试 ${retries}/${maxRetries}):`, postErr.message);
                    if (retries >= maxRetries) throw postErr;
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }
    } catch (error) {
        let errorMessage = `${fileName}上传失败\n平台:${platformMessage}\n`;
        if (error.response) {
            const status = error.response.status;
            if (status === 401) errorMessage += '认证失败：Token 可能无效或权限不足';
            else if (status === 403) errorMessage += '权限不足或 API 受限（可能限流）';
            else if (status === 404) errorMessage += '路径不存在（检查 NekoGame/ 目录与文件名）';
            else errorMessage += `HTTP ${status}: ${error.response.data?.message || '未知错误'}`;
        } else {
            errorMessage += error.message;
        }
        global.Notify(false, errorMessage);
        console.error('数据上传失败:', error);
        throw error; // 让上层感知
    }
}


const {backupFile} = require("./backupData");
// 从仓库下载文件
async function downloadFileFromRepo(repoUrl, token, fileName, localPath) {
    const { owner, repo, platform } = parseRepoUrl(repoUrl);
    let apiUrl;

    if (platform === 'gitee') {
        apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
    } else if (platform === 'github') {
        apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
    } else {
        throw new Error('不支持的仓库平台');
    }

    try {
        // 备份当前文件
        if (fs.existsSync(localPath)) {
            await backupFile(localPath, fileName);
        }

        const headers = platform === 'github' ? { Authorization: `Bearer ${token}` } : {};
        const params  = platform === 'gitee'  ? { access_token: token } : {};

        // 先拿元数据
        const meta = await axios.get(apiUrl, { params, headers });

        if (platform === 'github' && meta.data?.download_url) {
            // 优先使用 download_url 直下二进制
            const bin = await axios.get(meta.data.download_url, { responseType: 'arraybuffer', headers });
            fs.writeFileSync(localPath, Buffer.from(bin.data));
        } else if (meta.data?.content) {
            // 回退到 content base64
            const fileContent = Buffer.from(meta.data.content, 'base64');
            fs.writeFileSync(localPath, fileContent);
        } else {
            throw new Error('无法从 API 获取文件内容（content 为空且无 download_url）');
        }

        console.log('文件下载成功:', fileName);
    } catch (error) {
        global.Notify(false, `${fileName}下载失败\n平台:${platform}\n${error.response ? error.response.data.message : error.message}`);
        console.error('数据下载失败:', error);
        throw error;
    }
}

// 计算文件的 hash 值
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');  // 返回文件的 hash 值
}

// 数据同步代码
async function autoUploadOrDownload(repoUrl, token, localFilePath, fileName) {
    const { owner, repo, platform } = parseRepoUrl(repoUrl);
    const localFileTimestamp = getFileTimestamp(localFilePath);
    if (localFileTimestamp === null) {
        console.log('本地文件不存在或无法读取，跳过同步逻辑。');
        return;
    }
    const giteeFileTimestamp = await getFileTimestampFromRepo(repoUrl, token, fileName);
    if (giteeFileTimestamp === null) {
        // 如果 Gitee 或者 Github 上文件不存在，上传本地文件
        console.log(platform, fileName, '文件不存在，上传本地文件...');
        await uploadFileToRepo(repoUrl, token, localFilePath, fileName);
    } else {
        console.log('localFileTimestamp,giteeFileTimestamp', localFileTimestamp,giteeFileTimestamp);
        // 定义时间范围
        const TIME_TOLERANCE = 6000000; // 10小时
        const timeDiff = Math.abs(localFileTimestamp - giteeFileTimestamp);
        if (timeDiff <= TIME_TOLERANCE) {
            console.log('本地文件和仓库中文件时间差异较小，无需同步');
        } else {
            // 如果 Gitee 上文件更新，比较时间戳
            if (localFileTimestamp > giteeFileTimestamp) {
                // 如果本地文件更新，上传本地文件
                console.log('本地', fileName, '文件较新，准备上传...');
                await uploadFileToRepo(repoUrl, token, localFilePath, fileName);
            } else if (localFileTimestamp < giteeFileTimestamp) {
                // 如果 仓库 文件更新，下载 仓库的 文件
                console.log(platform, fileName, '文件较新，准备下载...');
                await downloadFileFromRepo(repoUrl, token, fileName, localFilePath);
            }
        }
    }
}

// 初始化上传下载
async function initUpload() {
    const config = loadSyncConfigFromFile();
    if (config) {
        const { decryptedRepoUrl, decryptedToken } = config;
        const neko_gameFilePath  = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'neko_game.db');
        const gacha_dataFilePath = path.join(process.env.NEKO_GAME_FOLDER_PATH, 'gacha_data.db');
        // 自动执行上传或下载操作（等待完成，避免前端过早提示成功）
        console.log('准备同步neko_game.db');
        await autoUploadOrDownload(decryptedRepoUrl, decryptedToken, neko_gameFilePath, 'neko_game.db');
        console.log('准备同步gacha_data.db');
        await autoUploadOrDownload(decryptedRepoUrl, decryptedToken, gacha_dataFilePath, 'gacha_data.db');
    }
}



initUpload();
