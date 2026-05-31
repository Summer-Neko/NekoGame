const { ipcMain, BrowserWindow, shell,app, dialog} = require('electron');
const { getGameTimeData, addGame, deleteGame, updateGame} = require('../database');
const {initializeTrackedGames} = require("../gameTracker"); // 确保导入 getGameTimeData


// 选择路径对话框
ipcMain.handle("dialog:openDirectory", async () => {
    return dialog.showOpenDialog({ properties: ["openDirectory"] });
});

// 选择图片文件对话框
ipcMain.handle("dialog:selectImageFile", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
            { name: 'Images', extensions: ['jpg', 'png', 'gif'] }
        ]
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
});

// 文件选择对话框，允许选择 .exe 文件
ipcMain.handle("dialog:openFile", async () => {
    return dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
            { name: 'Executable Files', extensions: ['exe'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
});


ipcMain.handle("load-games", async () => {
    return new Promise((resolve, reject) => {
        getGameTimeData((err, games) => {
            if (err) reject(err);
            else resolve(games);
        });
    });
});

ipcMain.handle("add-game", async (event, gameData) => {
    return new Promise((resolve, reject) => {
        addGame(gameData, (err, gameId) => {
            if (err) reject(err);
            else {
                resolve(gameId);
                initializeTrackedGames(); // 在添加新游戏后重新初始化游戏追踪
            }
        });
    });
});


// 删除游戏及相关数据
ipcMain.handle("delete-game", async (event, gameId) => {
    return new Promise((resolve, reject) => {
        deleteGame(gameId, (err) => {
            if (err) reject(err);
            else {
                initializeTrackedGames();
                resolve();
            }
        });
    });
});

// 更新游戏数据
ipcMain.handle("update-game", async (event, gameData) => {
    return new Promise((resolve, reject) => {
        updateGame(gameData, (err) => {
            if (err) reject(err);
            else {
                initializeTrackedGames();
                resolve();
            }
        });
    });
});
