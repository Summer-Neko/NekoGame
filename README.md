# Neko Game 应用程序

## 概述
Neko Game 是一款游戏管理应用程序，旨在通过现代化、暗色主题的用户界面来监控和分析您的游戏活动。该应用基于 Electron 构建，集成了多个核心功能，包括游戏时长记录、数据可视化和全面的游戏管理工具。

## 功能特点
- **游戏记录**：自动跟踪并记录游戏时长，提供详细的统计数据。
- **游戏库管理**：轻松添加、编辑和删除您的游戏库中需要记录的游戏。
- **成就和分析**：通过内置的成就系统和使用趋势图，让您深入了解您的游戏习惯。
- **无感使用**：可应用最小化至系统托盘，并支持后台运行与开机自启动。
- **本地数据存储**：使用 SQLite 本地安全地存储游戏数据。
- **高性能，低占用**：低功耗，高性能。无需担心会影响您的日常使用。
- **及时获取最新版本**：支持自动更新，在新版本发布时您将会收到通知

## 安装步骤
1. 克隆此仓库：
   ```bash
   https://github.com/Summer-Neko/NekoGame.git
   ```
2. 进入项目目录：
   ```bash
   cd nekogame
   ```
3. 安装依赖：
   ```bash
   npm install
   ```
4. 在开发模式下运行应用程序：
   ```bash
   npm start
   ```
5. 或从发布页面下载最新的 `.exe` 文件：
   请访问 [发布页面](https://github.com/Summer-Neko/NekoGame/releases) 下载最新版本的可执行文件并安装。

## 打包应用程序
要将应用程序打包分发，请运行：
```bash
npm run build
```
确保项目中已配置 `electron-builder` 来管理打包。

## 使用指南
- **添加游戏**：点击“添加游戏”按钮，填写所需信息，包括名称、图标和游戏路径，然后提交。
- **编辑游戏**：从游戏库中选择一个游戏，点击“编辑”选项，更新信息并保存更改。
- **删除游戏**：使用游戏详情菜单中的“删除”选项来移除游戏及其相关数据。

## 故障排除
### 常见问题
- **托盘图标缺失**：确保打包时图标路径正确并在打包配置中包含。
- **游戏时长未记录**：重新加载应用或使用刷新功能来重启时长检测。
- **路径或图片错误**：检查文件路径中的特殊符号，并确保图片文件被正确引用。以及是选择文件后缀是否正常。

### 已知限制
- 游戏时长记录需要在添加新游戏后进行定期更新。
- 编辑游戏详情在复杂配置时可能需要进一步优化。


