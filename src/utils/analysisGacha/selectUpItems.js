// const fs = require('fs');
// const path = require('path');
// const { ipcMain } = require('electron');
//
// // 获取数据路径
// const dataPath = process.env.NEKO_GAME_FOLDER_PATH;
// const selectUpItemsFile = path.join(dataPath, 'selectUpItems.json');
//
// // 定义初始数据（仅存“会改变歪判定的角色”）
// const defaultSelectUpItems = {
//     "zh-cn": {
//         "符玄": {
//             from: "2025-04-09"
//         },
//         "希儿": {
//             from: "2025-04-09"
//         },
//         "刃": {
//             from: "2025-04-09"
//         }
//     },
//     "zh-tw": {
//         "符玄": {
//             from: "2025-04-09"
//         },
//         "希兒": {
//             from: "2025-04-09"
//         },
//         "刃": {
//             from: "2025-04-09"
//         }
//     }
// };
//
// // 初始化文件
// async function initializeSelectUpItems() {
//     try {
//         if (!fs.existsSync(selectUpItemsFile)) {
//             await fs.promises.writeFile(
//                 selectUpItemsFile,
//                 JSON.stringify(defaultSelectUpItems, null, 2),
//                 'utf8'
//             );
//             console.log('selectUpItems.json 文件已创建');
//         }
//     } catch (error) {
//         console.error('初始化 selectUpItems 文件失败:', error);
//     }
// }
//
// initializeSelectUpItems();
//
// // 读取或创建
// async function loadOrCreateSelectUpItems() {
//     try {
//         if (!fs.existsSync(selectUpItemsFile)) {
//             await fs.promises.writeFile(
//                 selectUpItemsFile,
//                 JSON.stringify(defaultSelectUpItems, null, 2),
//                 'utf8'
//             );
//             console.log('selectUpItems.json 文件已创建');
//             return defaultSelectUpItems;
//         } else {
//             const data = await fs.promises.readFile(selectUpItemsFile, 'utf8');
//             return JSON.parse(data);
//         }
//     } catch (error) {
//         console.error('加载或创建 selectUpItems 文件失败:', error);
//         return defaultSelectUpItems;
//     }
// }
//
// // IPC：给前端用
// ipcMain.handle('get-select-up-items', async (event, lang) => {
//     const selectUpItemsData = await loadOrCreateSelectUpItems();
//     console.log('传入的可选UP语言版本是', lang);
//     return selectUpItemsData[lang] || selectUpItemsData['zh-cn'];
// });
//
// module.exports = {
//     loadOrCreateSelectUpItems
// };
