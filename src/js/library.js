// 加载游戏列表
async function loadGames() {
    try {
        const games = await window.electronAPI.loadGames();

        const gamesList = document.getElementById("games-list");
        if (games.length === 0) {
            document.getElementById("games-list").innerHTML = "<p>请添加游戏</p>";
        } else {
            gamesList.innerHTML = games.map(game => `
                <div class="list-item game-item" data-game-id="${game.id}"
                     style="background-image: url('${window.electronAPI.filePathToURL(game.poster_horizontal) || './src/assets/default-background.jpg'}');">
                    <img src="${window.electronAPI.filePathToURL(game.icon) || './src/assets/icon.png'}" class="game-icon" alt="${game.name}">
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
        openModal(document.getElementById("add-game-modal"));
        resetForm();
    });

    // 打开编辑游戏模态窗口
   document.getElementById("edit-game")?.addEventListener("click", () => {
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
        closeModal(document.getElementById("add-game-modal"));
    });

    // 关闭编辑窗口
    document.getElementById("close-edit-modal").addEventListener("click", () => {
        closeModal(document.getElementById("edit-game-modal"));
    });

    // 录入模态窗口的图片选择
    document.getElementById("icon-preview").addEventListener("click", async () => {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
            document.getElementById("icon-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(filePath)})`;
            document.getElementById("game-icon").dataset.filePath = filePath;
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

    //编辑功能
    // 编辑模态窗口的图片选择
    document.getElementById("edit-icon-preview").addEventListener("click", async () => {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
            document.getElementById("edit-icon-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(filePath)})`;
            document.getElementById("edit-game-icon").dataset.filePath = filePath;
        }
    });

    document.getElementById("edit-poster-vertical-preview").addEventListener("click", async () => {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
            document.getElementById("edit-poster-vertical-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(filePath)})`;
            document.getElementById("edit-game-poster-vertical").dataset.filePath = filePath;
        }
    });

    document.getElementById("edit-poster-horizontal-preview").addEventListener("click", async () => {
        const filePath = await window.electronAPI.selectImageFile();
        if (filePath) {
            document.getElementById("edit-poster-horizontal-preview").style.backgroundImage = `url(${window.electronAPI.filePathToURL(filePath)})`;
            document.getElementById("edit-game-poster-horizontal").dataset.filePath = filePath;
        }
    });

    // 编辑模态窗口路径选择
    document.getElementById("edit-browse-path").addEventListener("click", async () => {
        const filePath = await window.electronAPI.openFile();
        if (filePath) document.getElementById("edit-game-path").value = filePath;
    });
    initializeTrendChart(); // 初始化趋势图
}

// 录入新游戏
// async function addGame() {
//     const gameData = {
//         name: document.getElementById("game-name-input").value,
//         icon: document.getElementById("game-icon").dataset.filePath || './assets/icon.png',
//         poster_vertical: document.getElementById("game-poster-vertical").dataset.filePath || './assets/poster_vertical.webp',
//         poster_horizontal: document.getElementById("game-poster-horizontal").dataset.filePath || './assets/poster_horizontal.webp',
//         path: document.getElementById("game-path").value,
//     };
//
//     try {
//         await window.electronAPI.addGame(gameData);
//         closeModal(document.getElementById("add-game-modal"));
//         loadGames(); // 重新加载游戏列表
//         showSuccessMessage();
//         resetForm();
//     } catch (err) {
//         if (err.message.includes("UNIQUE constraint failed: games.path")) {
//             animationMessage(false, "路径重复，请检查并重新输入");
//         } else {
//             animationMessage(false, "无法录入游戏，请检查");
//         }
//     }
// }

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

    detailsContainer.classList.remove('show'); // 先移除显示类以触发消失动画

    // 使用 setTimeout 等待动画完成后再更新内容
    setTimeout(() => {
        window.electronAPI.getGameDetails(gameId)
            .then(game => {
                const avgDailyTime = game.avg_daily_time ? game.avg_daily_time.toFixed(2) + ' h' : '--';
                const lastPlayed = game.last_played ? game.last_played : "--";
                const rank = game.rank ? game.rank : "--";
                detailsContainer.innerHTML = `
                    <div class="tab-content">
                        <div class="game-detail-header">
                            <h2 id="game-name">${game.name}</h2>
                            <div class="ellipsis-menu">
                                <button class="menu-button">⋮</button>
                                <div class="menu-dropdown">
                                    <a href="#" id="edit-game">编辑游戏</a>
                                    <a href="#" id="delete-game">删除游戏</a>
                                </div>
                            </div>
                        </div>
                        
                        <p id="total-time">总时长: ${(game.total_time / 3600).toFixed(1)} h</p>
                        <p id="average-daily-time">近6个月的平均每日游戏时长（出勤日）: ${avgDailyTime}</p>
                        <p id="last-played">最后运行时间: ${game.last_played || '--'}</p>
                        <p id="rank">总时长排名: ${game.rank || '--'}</p>
                        
                        <div id="daily-time-chart" class="chart-container"></div>
                        <div class="game-trend">
                            <div class="chart-header"><h3>出勤日时间趋势图</h3></div>
                            <canvas id="game-trend-chart"></canvas>
                        </div>
                    </div>
                `;

                // 渲染游戏记录和趋势图
                renderGameDailyChart(gameId);
                loadGameTrendChart(gameId);

                // 添加显示类以触发出现动画
                setTimeout(() => {
                    detailsContainer.classList.add('show');
                }, 50);
            })
            .catch(error => {
                console.error("Error loading game details:", error);
            });
    }, 200); // 动画持续时间应与 CSS transition 匹配
}

function renderGameDailyChart(gameId) {
    window.electronAPI.getGameDailyTimeData(gameId).then(data => {
        // console.log("Received data:", data); // 检查是否包含最新日期的数据
        const dailyChartContainer = document.getElementById('daily-time-chart');
        if (!dailyChartContainer) {
            console.error('Daily time chart container not found');
            return;
        }

        // 清空容器，确保重新渲染时不会重复内容
        dailyChartContainer.innerHTML = '';

        // 创建每日游戏记录表内容
        const chartContainer = document.createElement('div');
        chartContainer.classList.add('contribution-chart-container');

        // 添加标题
        const chartTitle = document.createElement('div');
        chartTitle.classList.add('chart-title');
        chartTitle.textContent = '出勤表';
        chartContainer.appendChild(chartTitle);

        // 创建月份标题行
        const monthRow = document.createElement('div');
        monthRow.classList.add('month-row');

        const today = new Date();
        today.setHours(today.getHours() + 8);

        // 获取 180 天前的日期并加 8 小时
        const startDate = new Date();
        startDate.setDate(today.getDate() - 180);
        startDate.setHours(startDate.getHours() + 8);


        let currentMonth = startDate.getMonth();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // 计算并插入月份标题的位置
        for (let date = new Date(startDate); date <= today; date.setDate(date.getDate() + 1)) {
            if (date.getDate() === 1 || date.getTime() === startDate.getTime()) { // 每月的第一天或开始日期
                const monthName = months[date.getMonth()];
                const monthCell = document.createElement('div');
                monthCell.classList.add('month-cell');
                monthCell.textContent = monthName;
                const weekIndex = Math.floor((date - startDate) / (7 * 24 * 60 * 60 * 1000)); // 计算周数
                monthCell.style.gridColumnStart = weekIndex + 1;
                monthRow.appendChild(monthCell);
            }
        }
        chartContainer.appendChild(monthRow);

        // 创建每日小方块
        const contributionChart = document.createElement('div');
        contributionChart.classList.add('contribution-chart');

        for (let date = new Date(startDate); date <= today; date.setDate(date.getDate() + 1)) {
            const dateString = date.toISOString().split('T')[0];
            const dayData = data.find(d => d.date === dateString);
            const timePlayed = dayData ? dayData.total_time / 3600 : 0;


            const cell = document.createElement('div');
            cell.classList.add('contribution-cell');
            cell.dataset.date = dateString;
            cell.dataset.time = timePlayed.toFixed(2);
            cell.style.backgroundColor = getBackgroundColor(timePlayed);

            cell.addEventListener('mouseover', (event) => {
                // 检查并移除现有的 tooltip
                document.querySelector('.tooltip')?.remove();

                const tooltip = document.createElement('div');
                tooltip.classList.add('tooltip');
                tooltip.textContent = `${dateString}: ${timePlayed.toFixed(2)} h`;
                document.body.appendChild(tooltip);
                tooltip.style.left = `${event.pageX + 10}px`;
                tooltip.style.top = `${event.pageY + 10}px`;
            });

            cell.addEventListener('mouseout', () => {
                const tooltip = document.querySelector('.tooltip');
                if (tooltip) {
                    tooltip.classList.add('fade-out'); // 添加淡出动画类
                    tooltip.addEventListener('animationend', () => {
                        tooltip.remove();
                    });
                }
            });

            contributionChart.appendChild(cell);
        }
        chartContainer.appendChild(contributionChart);

        // 插入到 daily-time-chart 容器中
        dailyChartContainer.appendChild(chartContainer);
    }).catch(err => {
        console.error("Error rendering game daily chart:", err);
    });
}

// 获取背景颜色函数
function getBackgroundColor(hours) {
    if (hours === 0) return 'rgba(224,224,224,0.5)';
    if (hours < 1) return 'rgba(198,228,139,0.5)';
    if (hours < 2) return 'rgba(123,201,111,0.5)';
    if (hours < 4) return 'rgba(35,154,59,0.5)';
    return 'rgba(25,97,39,0.5)';
}



// 关闭函数
function closeAddGameModal() {
    closeModal(document.getElementById("add-game-modal"));
}

function closeEditGameModal() {
    closeModal(document.getElementById("edit-game-modal"));
}



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

        // 提取数据
        const labels = data.map(item => item.date);
        const values = data.map(item => item.total_time / 3600);

        // 计算非零天的平均时长
        const nonZeroValues = values.filter(value => value > 0);
        const averageTime = nonZeroValues.length
            ? nonZeroValues.reduce((acc, val) => acc + val, 0) / nonZeroValues.length
            : 0;

        if (window.gameTrendChart) window.gameTrendChart.destroy(); // 销毁旧图表实例

        // 创建图表实例
        window.gameTrendChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "游戏时长趋势",
                        data: values,
                        borderColor: "#36A2EB",
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: `平均时长：${averageTime.toFixed(1)} 小时`,
                        data: new Array(values.length).fill(averageTime), // 虚线的值为平均时长
                        borderColor: "rgba(255, 99, 132, 0.6)", // 红色虚线
                        borderDash: [5, 5], // 虚线样式
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 1,
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: { display: true, text: "日期" }
                    },
                    y: {
                        title: { display: true, text: "时长 (小时)" },
                        beginAtZero: true
                    }
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
        animationMessage(true, "成功录入游戏");
        loadGames();
    } catch (err) {
        console.error("Error adding game:", err);
        animationMessage(false, "无法录入游戏，请重试");
    }
});

function deleteGame() {
    const confirmation = confirm("确认删除此游戏及其所有数据吗？");
    if (!confirmation) return;

    const gameId = document.querySelector(".game-item.selected").dataset.gameId;

    window.electronAPI.deleteGame(gameId)
        .then(() => {
            animationMessage(false, "游戏已删除")
            loadGames(); // 重新加载游戏列表
            showNoGamesMessage(); // 清空游戏详情
        })
        .catch(error => {
            console.error("Error deleting game:", error);
            animationMessage(false, "删除游戏时发生错误，请重试")
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
        openModal(document.getElementById("edit-game-modal"));
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
        animationMessage(true, "游戏已更新");
        document.getElementById("edit-game-modal").style.display = "none";
        loadGames();
    } catch (err) {
        console.error("Error updating game:", err);
        animationMessage(false, "更新游戏时发生错误，请重试")
    }
});




// 初始化趋势图
function initializeTrendChart() {
    const ctx = document.getElementById("game-trend-chart")?.getContext("2d");
    if (ctx) {
        window.trendChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: "游戏时长趋势",
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

