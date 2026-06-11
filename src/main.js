const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
//在调用database前设置
require('./app/settings/dataFile');
require("./app/console");  // 导入日志管理
require('./utils/syncMessage'); //导入消息通知


const { initializeDatabase, getSetting, setSetting} = require('./app/database');
const { startGameTracking, sendRunningStatus } = require('./app/gameTracker');
const gotTheLock = app.requestSingleInstanceLock();


let tray = null;
let mainWindow;
global.mainWindow = mainWindow; // 将 mainWindow 保存在全局对象中
// let isWindowVisible = true;
let minimizeToTraySetting = false;


function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon.ico'); // 使用绝对路径
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
        { label: '退出应用', click: () => {
            tray.destroy();  // 销毁托盘图标
            app.exit();      // 退出应用
        }}
    ]);
    tray.setToolTip('Neko Game');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (!mainWindow) {
            createWindow();  // 如果主窗口未创建，则创建窗口
            sendRunningStatus(); // 立即发送最新的运行状态
        } else {
            if (mainWindow.isVisible()) {
                // mainWindow.hide();
                mainWindow.destroy();  // 销毁窗口并释放资源
                mainWindow = null; // 清除引用
                global.mainWindow = null;  // 清除全局引用
                // isWindowVisible = false;
            } else {
                mainWindow.show();
                // 每次窗口显示时发送刷新事件
                sendRunningStatus(); // 立即发送最新的运行状态
                mainWindow.focus();
            }
        }
    });
    global.tray = tray;
}


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1250,
        height: 700,
        minWidth: 1000,
        minHeight: 600,
        backgroundColor: '#1e1e1e',
        webPreferences: {
            sandbox: false,
            preload: path.join(__dirname, 'preload.js'), // 指定 preload 脚本
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false
        },
        frame: false
    });
    mainWindow.loadFile('src/index.html');
    loadBackground(mainWindow);

    // 打开开发者工具
    // mainWindow.webContents.once('dom-ready', () => {
    //    mainWindow.webContents.openDevTools();
    // });
    // 定义后全局导出 mainWindow
    global.mainWindow = mainWindow; // 更新global.mainWindow
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('set-app-path', app.getAppPath());
    });
    // mainWindow.on('minimize', () => {
    //     isWindowVisible = false;
    // });
    // mainWindow.on('restore', () => {
    //     isWindowVisible = true;
    // });
    mainWindow.on('close', (event) => {
        if (minimizeToTraySetting) {
            event.preventDefault();
            // 隐藏窗口
            // mainWindow.hide();
            mainWindow.destroy();  // 销毁窗口并释放资源
            mainWindow = null; //清除引用
            global.mainWindow = null;  // 清除全局引用
            // isWindowVisible = false;
        } else {
            mainWindow = null;  // 清除引用
            global.mainWindow = null;  // 清除全局引用
            app.quit();
        }
    });
}


ipcMain.handle("load-settings", async () => {
    const settings = {};
    const keys = ["minimizeToTray", "silentMode", "autoLaunch", "hardwareAcceleration"];

    for (const key of keys) {
        settings[key] = await new Promise((resolve) => {
            getSetting(key, (err, value) => {
                if (err) {
                    console.error(`Error loading setting ${key}:`, err);
                    resolve("false"); // 默认值
                } else {
                    resolve(value || "false"); // 默认为 "false"
                }
            });
        });
    }
    return settings;
});

ipcMain.handle("save-setting", (event, key, value) => {
    setSetting(key, value, (err) => {
        if (err) {
            console.error(`Error saving setting ${key}:`, err);
        } else {
            if (key === "minimizeToTray") {
                minimizeToTraySetting = value === "true";
            }
        }
    });
});


// 窗口控制事件
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => mainWindow.close());
async function initializeSettings() {
    minimizeToTraySetting = await new Promise((resolve) => {
        getSetting("minimizeToTray", (err, value) => {
            resolve(value === "true");
        });
    });

    const silentMode = await new Promise((resolve) => {
        getSetting("silentMode", (err, value) => {
            resolve(value === "true");
        });
    });

    // 如果 silentMode 为 true，不显示主窗口，只创建托盘图标
    if (silentMode) {
        createTray();
    } else {
        createWindow();
        createTray();
    }
}
if (!gotTheLock) {
    dialog.showErrorBox('Neko Game 已运行', '应用已在运行，请检查喵。'); // 提示用户已有进程
    app.exit(); // 使用 app.exit 退出当前实例
}
require('./utils/analysisGacha/analysisIpc'); // 引入分析相关的 IPC 逻辑
// 设置页面
require('./utils/settings/checkError');
require('./utils/settings/export/exportExcel');
const { loadBackground } = require('./utils/settings/background');
// 页面功能
require('./app/appIPC');
app.whenReady().then(() => {
    initializeDatabase();
    initializeSettings();
    // 启动后台进程检测，每20秒检测一次（由 gameTracker.js 设置间隔）
    startGameTracking();
    module.exports = { createWindow };
    require('./app/update'); // 初始化更新
    require('./app/uploadData/uploadDataIpc');  // 初始化上传代码
});

// 触发运行状态更新通知
ipcMain.on('running-status-updated', (event, runningStatus) => {
    if (mainWindow && mainWindow.webContents && mainWindow.isVisible()) {
        mainWindow.webContents.send('running-status-updated', runningStatus);
    }
});

ipcMain.on('request-running-status', (event) => {
    sendRunningStatus(); // 立即发送最新的运行状态
});

// 开机自启动
ipcMain.handle("set-auto-launch", (event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
});

ipcMain.on('open-external', (event, url) => {
    if (url) {
        shell.openExternal(url);
    }
});

app.on('window-all-closed', () => {
    // 在托盘模式下不退出应用
    if (process.platform !== 'darwin' && !tray) {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
