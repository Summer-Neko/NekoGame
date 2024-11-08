// DOM 加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
    libraryInit();
});

// 加载游戏列表
async function loadGames() {
    try {
        const games = await window.electronAPI.loadGames();

        const gamesList = document.getElementById("games-list");
        if (games.length === 0) {
            document.getElementById("game-details-container").innerHTML = "<p>请先添加游戏</p>";
        } else {
            gamesList.innerHTML = games.map(game => `
                <div class="list-item game-item" data-game-id="${game.id}"
                     style="background-image: url('${window.electronAPI.filePathToURL(game.poster_horizontal) || './assets/default-background.jpg'}');">
                    <img src="${window.electronAPI.filePathToURL(game.icon) || './assets/icon.png'}" class="game-icon" alt="${game.name}">
                    <div class="game-info">
                        <h4>${game.name}</h4>
                    </div>
                </div>
            `).join("");
            selectGame(games[0].id); // 默认选择第一个游戏
            setupGameClickEvents(); // 绑定点击事件
        }
        document.getElementById("game-count").textContent = `${games.length} 个游戏`;
    } catch (error) {
        console.error("Error loading games:", error);
    }
}


function showNoGamesMessage() {
    const detailsContainer = document.querySelector(".game-details");
    if (detailsContainer) {
        detailsContainer.innerHTML = "<p>请先添加游戏</p>";
    } else {
        console.error("Details container not found.");
    }
}

// 初始化函数
function libraryInit() {
    loadGames();

    // 录入窗口按钮
    document.getElementById("add-game").addEventListener("click", () => {
        closeEditGameModal(); // 确保关闭编辑窗口
        document.getElementById("add-game-modal").style.display = "flex";
        resetForm();
    });

    // 打开编辑游戏模态窗口
    document.getElementById("edit-game").addEventListener("click", () => {
        // 关闭录入框，确保没有冲突
        closeAddGameModal();
        editGame(); // 调用编辑游戏函数
    });

    // 事件委托：绑定到容器元素（例如 .game-details）上
    document.querySelector(".game-details").addEventListener("click", (event) => {
        if (event.target && event.target.id === "edit-game") {
            closeAddGameModal();
            editGame();
        } else if (event.target && event.target.id === "delete-game") {
            document.getElementById("delete-game").removeEventListener("click", deleteGame); // 防止重复绑定
            deleteGame();
        }
    });

    // 关闭录入窗口
    document.getElementById("close-modal").addEventListener("click", () => {
        document.getElementById("add-game-modal").style.display = "none";
    });

    // 关闭编辑窗口
    document.getElementById("close-edit-modal").addEventListener("click", () => {
        document.getElementById("edit-game-modal").style.display = "none";
    });

    // 录入模态窗口的图片选择
    document.getElementById("icon-preview").addEventListener("click", async () => {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
            document.getElementById("icon-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(filePath)})`;
            document.getElementById("game-icon").dataset.filePath = filePath;
        }
    });
    
    // 编辑模态窗口的图片选择
    document.getElementById("edit-icon-preview").addEventListener("click", async () => {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
            document.getElementById("edit-icon-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(filePath)})`;
            document.getElementById("edit-game-icon").dataset.filePath = filePath;
        }
    });

    document.getElementById("poster-vertical-preview").addEventListener("click", async () => {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
            document.getElementById("poster-vertical-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(filePath)})`;
            document.getElementById("game-poster-vertical").dataset.filePath = filePath;
        }
    });
    
    document.getElementById("poster-horizontal-preview").addEventListener("click", async () => {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
            document.getElementById("poster-horizontal-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(filePath)})`;
            document.getElementById("game-poster-horizontal").dataset.filePath = filePath;
        }
    });
    

    // 录入模态窗口路径选择
    document.getElementById("browse-path").addEventListener("click", async () => {
        const filePath = await window.electronAPI.openFile();
        if (filePath) document.getElementById("game-path").value = filePath;
    });
    // 编辑模态窗口路径选择
    document.getElementById("edit-browse-path").addEventListener("click", async () => {
        const filePath = await window.electronAPI.openFile();
        if (filePath) document.getElementById("edit-game-path").value = filePath;
    });
    initializeTrendChart(); // 初始化趋势图
}

// 录入新游戏
async function addGame() {
    const gameData = {
        name: document.getElementById("game-name-input").value,
        icon: document.getElementById("game-icon").dataset.filePath || './assets/icon.png',
        poster_vertical: document.getElementById("game-poster-vertical").dataset.filePath || './assets/poster_vertical.webp',
        poster_horizontal: document.getElementById("game-poster-horizontal").dataset.filePath || './assets/poster_horizontal.webp',
        path: document.getElementById("game-path").value,
    };

    try {
        await window.electronAPI.addGame(gameData);
        document.getElementById("add-game-modal").style.display = "none";
        loadGames(); // 重新加载游戏列表
        showSuccessMessage();
        resetForm();
    } catch (err) {
        if (err.message.includes("UNIQUE constraint failed: games.path")) {
            alert("路径重复，请检查并重新输入！");
        } else {
            alert("无法录入游戏，请重试");
        }
    }
}

// 重置表单
function resetForm() {
    document.getElementById("game-name-input").value = '';
    document.getElementById("game-path").value = '';
    document.getElementById("icon-preview").style.backgroundImage = "url('./assets/icon.png')";
    document.getElementById("poster-vertical-preview").style.backgroundImage = "url('./assets/poster_vertical.webp')";
    document.getElementById("poster-horizontal-preview").style.backgroundImage = "url('./assets/poster_horizontal.webp')";
}

// 显示录入成功提示
function showSuccessMessage() {
    const message = document.getElementById("success-message");
    message.style.display = "block";
    setTimeout(() => {
        message.style.display = "none";
    }, 2000);
}

// 绑定游戏列表点击事件
function setupGameClickEvents() {
    const gameItems = document.querySelectorAll(".game-item");
    gameItems.forEach(item => {
        item.addEventListener("click", () => {
            // 移除其他游戏项的选中样式
            gameItems.forEach(el => el.classList.remove("selected"));
            item.classList.add("selected"); // 为当前游戏项添加选中样式
            const gameId = item.getAttribute("data-game-id");
            selectGame(gameId); // 调用选择游戏的逻辑
        });
    });
}


// 游戏选中效果
function selectGame(gameId) {
    document.querySelectorAll('.game-item').forEach(item => item.classList.remove('selected'));
    const selectedItem = document.querySelector(`.game-item[data-game-id="${gameId}"]`);
    if (selectedItem) selectedItem.classList.add('selected');
    showGameDetails(gameId);
}


// 显示游戏详细信息

function showGameDetails(gameId) {
    const detailsContainer = document.querySelector(".game-details");
    if (!detailsContainer) {
        console.error("Details container not found");
        return;
    }

    window.electronAPI.getGameDetails(gameId)
        .then(game => {
            const lastPlayed = game.last_played ? game.last_played : "--";
            const rank = game.rank ? game.rank : "--";
            detailsContainer.innerHTML = `
                <h2 id="game-name">${game.name}</h2>
                <p id="total-time">总时长: ${(game.total_time / 3600).toFixed(1)} h</p>
                <p id="last-played">最后运行时间: ${lastPlayed}</p>
                <p id="rank">总时长排名: ${rank}</p>
                <div class="ellipsis-menu">
                    <button class="menu-button">⋮</button>
                    <div class="menu-dropdown">
                        <a href="#" id="edit-game">编辑游戏</a>
                        <a href="#" id="delete-game">删除游戏</a>
                    </div>
                </div>
                <div class="game-trend">
                    <canvas id="game-trend-chart" width="400" height="200"></canvas>
                </div>
            `;
            loadGameTrendChart(gameId);
        })
        .catch(error => {
            console.error("Error loading game details:", error);
        });
}
// 关闭函数
function closeAddGameModal() {
    document.getElementById("add-game-modal").style.display = "none";
}

function closeEditGameModal() {
    document.getElementById("edit-game-modal").style.display = "none";
}


document.getElementById("edit-game")?.addEventListener("click", editGame);
document.getElementById("delete-game")?.addEventListener("click", deleteGame);


// 加载并显示游戏趋势图
async function loadGameTrendChart(gameId) {
    const ctx = document.getElementById("game-trend-chart")?.getContext("2d");
    if (!ctx) {
        console.error("Canvas element for game trend chart not found.");
        return;
    }

    try {
        const data = await window.electronAPI.getGameTrendData(gameId);
        if (!data || data.length === 0) {
            console.log("No trend data available for this game.");
            document.querySelector(".game-trend").innerHTML = "<p>暂无趋势数据</p>";
            return;
        }
        const labels = data.map(item => item.date);
        const values = data.map(item => item.total_time / 3600);

        if (window.gameTrendChart) window.gameTrendChart.destroy(); // 销毁旧图表实例
        window.gameTrendChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "游戏时长趋势",
                    data: values,
                    borderColor: "#36A2EB",
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: "日期" } },
                    y: { title: { display: true, text: "时长 (小时)" }, beginAtZero: true }
                }
            }
        });
    } catch (error) {
        console.error("Error loading game trend data:", error);
    }
}





    // 提交添加游戏表单
    document.getElementById("add-game-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const gameData = {
            name: document.getElementById("game-name-input").value,
            icon: document.getElementById("game-icon").dataset.filePath || './assets/icon.png',
            poster_vertical: document.getElementById("game-poster-vertical").dataset.filePath || './assets/poster_vertical.webp',
            poster_horizontal: document.getElementById("game-poster-horizontal").dataset.filePath || './assets/poster_horizontal.webp',
            path: document.getElementById("game-path").value,
        };
    
        try {
            await window.electronAPI.addGame(gameData);
            document.getElementById("add-game-modal").style.display = "none";
            loadGames();
        } catch (err) {
            console.error("Error adding game:", err);
            alert("无法录入游戏，请重试");
        }
    });    

function deleteGame() {
    const confirmation = confirm("确认删除此游戏及其所有数据吗？");
    if (!confirmation) return;

    const gameId = document.querySelector(".game-item.selected").dataset.gameId;

    window.electronAPI.deleteGame(gameId)
        .then(() => {
            alert("游戏已删除");
            loadGames(); // 重新加载游戏列表
            showNoGamesMessage(); // 清空游戏详情
        })
        .catch(error => {
            console.error("Error deleting game:", error);
            alert("删除游戏时发生错误，请重试。");
        });
}



// 绑定编辑游戏事件
function editGame() {
    const gameId = document.querySelector(".game-item.selected")?.dataset.gameId;
    if (!gameId) return alert("请选择一个游戏进行编辑");

    window.electronAPI.getGameDetails(gameId).then(game => {
        // 填充编辑表单数据
        document.getElementById("edit-game-name-input").value = game.name;
        document.getElementById("edit-game-icon").dataset.filePath = game.icon;
        document.getElementById("edit-icon-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(game.icon)})`;
        document.getElementById("edit-game-poster-vertical").dataset.filePath = game.poster_vertical;
        document.getElementById("edit-poster-vertical-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(game.poster_vertical)})`;
        document.getElementById("edit-game-poster-horizontal").dataset.filePath = game.poster_horizontal;
        document.getElementById("edit-poster-horizontal-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(game.poster_horizontal)})`;
        document.getElementById("edit-game-path").value = game.path;

        // 显示编辑模态窗口
        document.getElementById("edit-game-modal").style.display = "flex";
    }).catch(error => {
        console.error("Error fetching game details:", error);
    });
}

// 编辑表单提交
document.getElementById("edit-game-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const gameId = document.querySelector(".game-item.selected")?.dataset.gameId;
    const gameData = {
        id: gameId,
        name: document.getElementById("edit-game-name-input").value,
        icon: document.getElementById("edit-game-icon").dataset.filePath || './assets/icon.png',
        poster_vertical: document.getElementById("edit-game-poster-vertical").dataset.filePath || './assets/poster_vertical.webp',
        poster_horizontal: document.getElementById("edit-game-poster-horizontal").dataset.filePath || './assets/poster_horizontal.webp',
        path: document.getElementById("edit-game-path").value,
    };

    try {
        await window.electronAPI.updateGame(gameData);
        alert("游戏已更新");
        document.getElementById("edit-game-modal").style.display = "none";
        loadGames();
    } catch (err) {
        console.error("Error updating game:", err);
        alert("更新游戏时发生错误，请重试");
    }
});




// 初始化趋势图
function initializeTrendChart() {
    const ctx = document.getElementById("trend-chart")?.getContext("2d");
    if (ctx) {
        window.trendChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: "时长趋势",
                    data: [],
                    borderColor: "#4BC0C0",
                    backgroundColor: "rgba(75, 192, 192, 0.1)",
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: "日期" } },
                    y: { title: { display: true, text: "时长 (小时)" }, beginAtZero: true }
                }
            }
        });
    }
}

// 确保 libraryInit 可以被 renderer.js 调用
window.libraryInit = libraryInit;
