// 加载玩家 UID 下拉列表
async function loadPlayerUIDs(defaultUid) {
    const players = await window.electronAPI.getPlayerUIDs(); // 从数据库获取所有 UID
    const uidDropdown = document.getElementById('uid-dropdown');
    const selectedDisplay = document.querySelector('.selected-display');
    const optionsList = document.querySelector('.options-list');
    selectedDisplay.textContent = defaultUid || '请先刷新数据';
    optionsList.innerHTML = ''; // 清空选项
    players.forEach(uid => {
        const option = document.createElement('li');
        option.classList.add('dropdown-option');
        option.textContent = uid;
        option.dataset.value = uid;
        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', async (event) => {
            event.stopPropagation(); // 阻止事件冒泡到 option 上
            const confirmed = confirm(`确定要删除 UID: ${uid} 的所有记录吗？`);
            if (confirmed) {
                try {
                    await window.electronAPI.invoke('delete-gacha-records', uid, 'gacha_logs');
                    const lastUid = await window.electronAPI.getLastQueryUid();
                    await loadPlayerUIDs(lastUid); // 加载玩家 UID 下拉框
                    await loadGachaRecords(lastUid); // 加载对应记录
                    animationMessage(true, `成功删除 UID: ${uid} 的记录`);
                } catch (error) {
                    animationMessage(false, `删除失败: ${error.message}`);
                }
            }
        });
        // 将删除按钮添加到选项中
        option.appendChild(deleteBtn);
        if (uid === defaultUid) {
            selectedDisplay.textContent = uid;
            option.classList.add('active');
        }
        option.addEventListener('click', () => {
            selectedDisplay.textContent = uid;
            selectedDisplay.dataset.value = uid;
            document.querySelectorAll('.dropdown-option').forEach(opt => {
                opt.classList.remove('active');
            });
            option.classList.add('active');
            optionsList.classList.remove('show');
        });
        optionsList.appendChild(option);
    });
}

// 加载祈愿记录
async function loadGachaRecords(uid) {
    const records = await window.electronAPI.getGachaRecords();
    const container = document.getElementById('record-display');
    if (!container) {
        console.error('Error: Element with ID "record-display" not found.');
        return;
    }
    container.innerHTML = ''; // 清空显示内容
    console.log('Container cleared:', container.innerHTML);

    const filteredRecords = records.filter(r => r.player_id === uid);
    if (!filteredRecords.length) {
        container.innerHTML = '<p>没有唤取记录。请先打开游戏祈愿界面，然后点击刷新数据</p>';
        return;
    }

    // 取得第一条记录的 lang 属性，若不存在则默认使用 'zh-cn'
    const lang = filteredRecords[0].lang || 'zh-cn';
    // 根据 lang 从后端获取对应的 commonItems
    commonItems = await window.electronAPI.invoke('get-common-items', lang);

    const pools = categorizeRecords(filteredRecords);
    const GACHA_TYPE_ORDER = [
        "角色活动唤取", "武器活动唤取", "角色常驻唤取",
        "武器常驻唤取", "新手唤取", "新手自选唤取",
        "感恩定向唤取"
    ];
    console.log("1")
    const safeValue = (value, fallback = "无数据") => (value === null || value === undefined ? fallback : value);

    const generateStatsCards = (avgFiveStarText, avgUpText, mostDrawsText, leastDrawsText) => `
        <div class="stats-container">
            <div class="stats-card">
                <div class="stats-title">平均5星</div>
                <div class="stats-value">${safeValue(avgFiveStarText)}</div>
            </div>
            <div class="stats-card">
                <div class="stats-title">平均UP</div>
                <div class="stats-value">${safeValue(avgUpText)}</div>
            </div>
            <div class="stats-card">
                <div class="stats-title">最非</div>
                <div class="stats-value">${safeValue(mostDrawsText)}</div>
            </div>
            <div class="stats-card">
                <div class="stats-title">最欧</div>
                <div class="stats-value">${safeValue(leastDrawsText)}</div>
            </div>
        </div>
    `;

    const generateProgressBar = (draws, maxDraws, color, label) => {
        const progressWidth = Math.min((draws / maxDraws) * 100, 100); // 限制最大宽度为 100%
        return `
            <div class="progress-card">
                <div class="progress-card-title">${label}</div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progressWidth}%; background: ${color};">
                        ${draws}
                    </div>
                </div>
            </div>
        `;
    };
    const generateRatingCards = (records, poolType) => {
        const fiveStarAvg = calculateDrawsBetween(records, 5);
        const isCharacterEvent = poolType === "角色活动唤取";
        const noDeviationRate = isCharacterEvent ? calculateNoDeviationRate(records) : null;
        const avgUp = poolType === "角色活动唤取" ? calculateUpAverage(pools[poolType]) : null;
        const avgUpText = typeof avgUp === "number" ? `${avgUp.toFixed(2)}` : avgUp;
        const careerRating = getRating(fiveStarAvg, avgUpText);
        const chartId = `star-pie-chart-${poolType}`; // 动态生成唯一 ID

        const ratingDetails = isCharacterEvent
            ? `
                <div class="rating-detail">
                    <h3>生涯评级</h3>
                    <p>${careerRating}</p>
                </div>
                <div class="rating-detail">
                    <h3>不歪概率</h3>
                    <p>${noDeviationRate || "无数据"}</p>
                </div>
            `
            : `
                <div class="rating-detail full">
                    <h3>生涯评级</h3>
                    <p>${careerRating}</p>
                </div>
            `;

        return `
            <div class="rating-container">
                <div class="rating-chart-card">
                    <canvas id="${chartId}" width="150" height="150"></canvas>
                </div>
                <div class="rating-info-card">
                    ${ratingDetails}
                </div>
            </div>
        `;
    };

    GACHA_TYPE_ORDER.forEach(poolType => {
        console.log("2")
        if (pools[poolType]) {
            const poolSection = document.createElement('div');
            poolSection.className = 'card-pool';

            const totalDraws = pools[poolType].length;
            const avgFiveStar = calculateDrawsBetween(pools[poolType], 5);
            const avgUp = poolType === "角色活动唤取" ? calculateUpAverage(pools[poolType]) : null;

            const avgFiveStarText = typeof avgFiveStar === "number" ? `${avgFiveStar.toFixed(2)}` : avgFiveStar;
            const avgUpText = typeof avgUp === "number" ? `${avgUp.toFixed(2)}` : avgUp;

            const lastFiveStarDraws = calculateLastDraws(pools[poolType], 5);
            const lastFourStarDraws = calculateLastDraws(pools[poolType], 4);

            // "最非" 和 "最欧"
            const { maxDraws: mostDraws, minDraws: leastDraws } = calculateMostDraws(pools[poolType], 5);
            const mostDrawsText = safeValue(mostDraws, "暂未抽出五星");
            const leastDrawsText = safeValue(leastDraws, "暂未抽出五星");

            const progressBars = `
                ${generateProgressBar(lastFiveStarDraws, 80, 'rgba(243, 213, 138,0.7)', '距离上个五星')}
                ${generateProgressBar(lastFourStarDraws, 10, 'rgba(214, 199, 255,0.7)', '距离上个四星')}
            `;
            const ratingContent = generateRatingCards(pools[poolType], poolType)
            poolSection.innerHTML = `
                <div class="card-header">
                    <span class="card-title">${poolType}</span>
                    <span class="total-draws">${totalDraws} 抽</span>
                </div>
                <div class="record-tabs">
                    <button class="record-tab active" data-tab="stats">统计</button>
                    <button class="record-tab" data-tab="rating">评分</button>
                </div>
                <div class="tab-content">
                    <div id="stats" class="tab-panel active">
                        ${progressBars}
                        ${generateStatsCards(avgFiveStarText, avgUpText, mostDrawsText, leastDrawsText)}
                    </div>
                    <div id="rating" class="tab-panel">
                        ${ratingContent}
                    </div>
                </div>
                <div class="record-list-tabs">
                    <button class="record-tab active" data-tab="overview">概览</button>
                    <button class="record-tab" data-tab="details">详细</button>
                </div>
                <div class="record-list">
                    ${generateOverview(pools[poolType])}
                </div>
            `;
            console.log("3");
            container.appendChild(poolSection);
            // 初始化标签和记录切换逻辑
            initTabs();
            initRecordListTabs(pools[poolType], poolSection);
            renderPieChart(pools[poolType], poolType);
            charts[poolType].update({
                duration: 0, // 禁用动画
            });
        }
    });
    initScrollLogic(); // 初始化滚动逻辑
}


// 添加滚动逻辑
function initScrollLogic() {
    const recordDisplay = document.getElementById('record-display');
    if (!recordDisplay) {
        console.error('Error: Element with ID "record-display" not found.');
        return;
    }

    recordDisplay.addEventListener('wheel', (event) => {
        const target = event.target.closest('.record-list');
        if (target) {
            if (
                (event.deltaY < 0 && target.scrollTop > 0) || // 向上滚动
                (event.deltaY > 0 && target.scrollTop + target.offsetHeight < target.scrollHeight) // 向下滚动
            ) {
                return;
            }
        }

        // 横向滚动逻辑
        recordDisplay.scrollLeft += event.deltaY;
        event.preventDefault(); // 阻止页面默认行为
    });
}


// 监听 UID 切换
async function gachaWuwaInit() {
    const lastUid = await window.electronAPI.getLastQueryUid();
    await loadPlayerUIDs(lastUid); // 加载玩家 UID 下拉框
    await loadGachaRecords(lastUid); // 加载对应记录
    initScrollLogic(); // 初始化滚动逻辑
    initRecordTooltips();

    // 监听 UID 切换
    document.querySelector('.selected-display').addEventListener('click', async () => {
        const optionsList = document.querySelector('.options-list');
        optionsList.classList.toggle('show');
    });

    document.querySelector('.options-list').addEventListener('click', async (event) => {
        if (event.target && event.target.classList.contains('dropdown-option')) {
            const selectedUid = event.target.dataset.value;

            // 更新下拉显示
            document.querySelector('.selected-display').textContent = selectedUid;
            document.querySelector('.selected-display').dataset.value = selectedUid;

            // 收起下拉列表
            document.querySelector('.options-list').classList.remove('show');

            // 加载对应的抽卡记录
            await loadGachaRecords(selectedUid);
        }
    });

    // 刷新数据
    document.getElementById('refresh-data').addEventListener('click', async () => {
        const refreshButton = document.getElementById('refresh-data');
        // 禁用按钮，防止重复点击
        refreshButton.disabled = true;
        refreshButton.innerText = '请等待...';
        try {
            const result = await window.electronAPI.refreshGachaRecords();
            if (result.success) {
                const uid = document.querySelector('.selected-display').textContent;
                await loadGachaRecords(uid); // 刷新后重新加载
            } else {
                console.error(result.error);
            }
        } catch (error) {
            console.error('发生错误:', error);
        } finally {
            // 无论请求是否成功，启用按钮
            refreshButton.disabled = false;
            refreshButton.innerText = '刷新数据';
        }
    });
}

// 如果 charts 已存在，则不会重新定义
if (typeof charts === "undefined") {
    var charts = {};
}

window.electronAPI.on('gacha-records-status', (event, status) => {
    const statusElement = document.getElementById('status-display');
    if (statusElement) {
        statusElement.textContent = status;
    }
});

// 暴露初始化函数
window.gachaWuwaInit = gachaWuwaInit;
