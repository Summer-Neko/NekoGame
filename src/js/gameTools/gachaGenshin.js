// 加载玩家 UID 下拉列表
async function loadPlayerUIDs(defaultUid) {
    const players = await window.electronAPI.invoke('get-genshin-player-uids'); // 从数据库获取所有 UID
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
                    await window.electronAPI.invoke('delete-gacha-records', uid, 'genshin_gacha');
                    const lastUid = await window.electronAPI.invoke('get-last-genshin-uid');
                    await loadPlayerUIDs(lastUid); // 加载玩家 UID 下拉框
                    await loadGachaRecords(lastUid); // 加载对应记录
                    animationMessage(true, `成功删除 UID: ${uid} 的记录`);
                    applyHiddenPools();
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
    const records = await window.electronAPI.invoke('get-genshin-gacha-records');
    const container = document.getElementById('record-display');
    if (!container) {
        console.error('Error: Element with ID "record-display" not found.');
        return;
    }
    // 清空内容
    container.innerHTML = '';
    console.log('Container cleared:', container.innerHTML);
    // console.log(records);
    const filteredRecords = records.filter(r => r.uid === uid);
    if (!filteredRecords.length) {
        container.innerHTML = '<p>没有祈愿记录。请先打开游戏祈愿界面，然后点击刷新数据</p>';
        return;
    }

    // 取得第一条记录的 lang 属性，若不存在则默认使用 'zh-cn'
    const lang = filteredRecords[0].lang || 'zh-cn';
    // 根据 lang 从后端获取对应的 commonItems
    commonItems = await window.electronAPI.invoke('get-common-items', lang);

    const pools = categorizeRecords(filteredRecords);
    const GACHA_TYPE_ORDER = [
        "角色活动祈愿", "武器活动祈愿", "常驻祈愿",
        "集录祈愿", "新手祈愿"
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
        const isCharacterOrConeEvent = poolType === "角色活动祈愿" || poolType === "武器活动祈愿"; // 判断角色活动跃迁或光锥活动跃迁
        const noDeviationRate = isCharacterOrConeEvent ? calculateNoDeviationRate(records) : null;
        const avgUp = isCharacterOrConeEvent ? calculateUpAverage(pools[poolType]) : null; // 修改这里，两个池子都能计算
        const avgUpText = typeof avgUp === "number" ? `${avgUp.toFixed(2)}` : avgUp;
        const careerRating = getRating(fiveStarAvg, avgUpText);
        const chartId = `star-pie-chart-${poolType}`; // 动态生成唯一 ID

        const ratingDetails = isCharacterOrConeEvent
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
            const avgUp = (poolType === "角色活动祈愿" || poolType === "武器活动祈愿") ? calculateUpAverage(pools[poolType]) : null;

            const avgFiveStarText = typeof avgFiveStar === "number" ? `${avgFiveStar.toFixed(2)}` : avgFiveStar;
            const avgUpText = typeof avgUp === "number" ? `${avgUp.toFixed(2)}` : avgUp;

            const lastFiveStarDraws = calculateLastDraws(pools[poolType], 5);
            const lastFourStarDraws = calculateLastDraws(pools[poolType], 4);

            // "最非" 和 "最欧"
            const { maxDraws: mostDraws, minDraws: leastDraws } = calculateMostDraws(pools[poolType], 5);
            const mostDrawsText = safeValue(mostDraws, "暂未抽出五星");
            const leastDrawsText = safeValue(leastDraws, "暂未抽出五星");

            const progressBars = `
                ${generateProgressBar(lastFiveStarDraws, 90, 'rgba(243, 213, 138,0.7)', '距离上个五星')}
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
                duration: 0,
            });
        }
    });
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
async function gachaGenshinInit() {
    const lastUid = await window.electronAPI.invoke('get-last-genshin-uid');
    await loadPlayerUIDs(lastUid); // 加载玩家 UID 下拉框
    await loadGachaRecords(lastUid); // 加载对应记录
    initScrollLogic(); // 初始化滚动逻辑
    initRecordTooltips();
    initSettingsMenu();
    applyHiddenPools();

    // 监听 UID 切换
    document.querySelector('.selected-display').addEventListener('click', async () => {
        const optionsList = document.querySelector('.options-list');
        optionsList.classList.toggle('show');
    });

    document.querySelector('.options-list').addEventListener('click', async (event) => {
        if (event.target && event.target.classList.contains('dropdown-option')) {
            const selectedUid = event.target.dataset.value;

            document.querySelector('.selected-display').textContent = selectedUid;
            document.querySelector('.selected-display').dataset.value = selectedUid;

            document.querySelector('.options-list').classList.remove('show');

            await loadGachaRecords(selectedUid);
            applyHiddenPools();
        }
    });

    // 刷新数据
    document.getElementById('refresh-data').addEventListener('click', async () => {
        const refreshButton = document.getElementById('refresh-data');
        refreshButton.disabled = true;
        refreshButton.innerText = '请等待...';
        try {
            // 禁用按钮，防止重复点击
            const result = await window.electronAPI.invoke('fetchGenshinGachaData');
            animationMessage(result.success, result.message);
            if (result.success) {
                const uid = document.querySelector('.selected-display').textContent;
                await loadGachaRecords(uid); // 刷新后重新加载
                applyHiddenPools();
            }
        }catch (error) {
            console.error('发生错误:', error); // 捕获并输出异常
        } finally {
            refreshButton.innerText = '刷新数据';
            refreshButton.disabled = false;
        }
    });
}

if (typeof charts === "undefined") {
    var charts = {};
}

window.electronAPI.on('gacha-records-status', (event, status) => {
    const statusElement = document.getElementById('status-display');
    if (statusElement) {
        statusElement.textContent = status;
    }
});

function initSettingsMenu() {
  const btn = document.getElementById('settings-btn');
  const menu = document.getElementById('settings-menu');

  const openMenu = () => {
    menu.classList.remove('hidden');
    // 下一帧再加 show，触发动画
    requestAnimationFrame(() => menu.classList.add('show'));
  };

  const closeMenu = () => {
    menu.classList.remove('show');
    // 动画结束后隐藏
    setTimeout(() => menu.classList.add('hidden'), 160);
  };

  const toggleMenu = () => {
    const isOpen = menu.classList.contains('show');
    if (isOpen) closeMenu();
    else openMenu();
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // 点击菜单内部不关闭
  menu.addEventListener('click', (e) => e.stopPropagation());

  // 点击页面空白关闭
  document.addEventListener('click', () => {
    if (menu.classList.contains('show')) closeMenu();
  });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('show')) closeMenu();
  });

  // 清除 URL 缓存文件
  document.getElementById('menu-clear-url-cache').addEventListener('click', async () => {
    closeMenu();
    try {
      const result = await window.electronAPI.invoke('clear-genshin-url-cache');
      // 兼容你常用返回：{success, message}
      if (result?.success !== undefined) animationMessage(result.success, result.message);
      else animationMessage(true, '已清除 URL 缓存文件');
    } catch (err) {
      animationMessage(false, `清除失败\n${err.message}`);
    }
  });

  // 导出数据
  document.getElementById('exportGenshin').addEventListener('click', async () => {
      closeMenu();
      await handleExport('Genshin', 'get-genshin-player-uids', 'export-genshin-data');
  });

  // 导入数据
  document.getElementById('importGenshin').addEventListener('click', async () => {
        closeMenu();
        document.getElementById('importGenshin').disabled = true;
        document.getElementById('importGenshin').innerText = '请等待...';
        try {
            const result = await window.electronAPI.invoke('import-genshin-data');
            animationMessage(result.success, result.message);
        } catch (error) {
            console.error('导入数据时发生错误:', error);
            animationMessage(result.success, `导入失败\n${result.message}`);
        } finally {
            document.getElementById('importGenshin').disabled = false;
            document.getElementById('importGenshin').innerText = '导入数据';
        }
  });

  // 隐藏卡池
  document.getElementById('menu-hide-pools').addEventListener('click', async () => {
    closeMenu();
    openHidePoolsModal();
  });
  // 按时间删除抽卡数据
  document.getElementById('menu-delete-by-time').addEventListener('click', () => {
    closeMenu();
    openDeleteByTimeModal(); // 新弹窗
});
}

/** ===== 隐藏卡池弹窗逻辑 ===== */
function openHidePoolsModal() {
  const modal = document.getElementById('hidePoolsModal');
  const list = document.getElementById('hidePoolsList');
  const closeBtn = document.getElementById('closeHidePoolsModal');
  const selectAllBtn = document.getElementById('hidePoolsSelectAll');
  const confirmBtn = document.getElementById('hidePoolsConfirm');

  // 你页面里的卡池顺序就是这样生成的
  const poolOptions = getRenderedPoolTitles();

  // 从 localStorage 读隐藏列表
  const STORAGE_KEY = 'genshin_hidden_pools';
  const hiddenPools = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

  // 重置列表
  list.innerHTML = '';
  poolOptions.forEach(name => {
    const item = document.createElement('div');
    item.className = 'uid-item';
    item.innerText = name;
    item.dataset.pool = name;
    if (hiddenPools.has(name)) item.classList.add('selected');

    item.addEventListener('click', () => {
      item.classList.toggle('selected');
      updateSelectAllText();
    });

    list.appendChild(item);
  });

  const updateSelectAllText = () => {
    const items = Array.from(list.querySelectorAll('.uid-item'));
    const allSelected = items.every(x => x.classList.contains('selected'));
    if (allSelected) {
      selectAllBtn.classList.add('primary');
      selectAllBtn.innerText = '取消全选';
    } else {
      selectAllBtn.classList.remove('primary');
      selectAllBtn.innerText = '全选';
    }
  };
  updateSelectAllText();

  // 打开弹窗：你项目里 gameTools.js 使用了 openModal(modal) :contentReference[oaicite:6]{index=6}
  // 这里兼容：如果没全局 openModal，就用最基础的 display:flex
  if (typeof openModal === 'function') openModal(modal);
  else {
    modal.style.display = 'flex';
    modal.classList.remove('fade-out');
  }

  // 关闭
  const close = () => {
    if (typeof closeModal === 'function') closeModal(modal);
    else modal.style.display = 'none';
  };
  closeBtn.onclick = close;

  // 全选/取消全选
  selectAllBtn.onclick = () => {
    const items = Array.from(list.querySelectorAll('.uid-item'));
    const allSelected = items.every(x => x.classList.contains('selected'));
    items.forEach(x => x.classList.toggle('selected', !allSelected));
    updateSelectAllText();
  };

  // 应用：保存到 localStorage，并刷新当前展示
  confirmBtn.onclick = async () => {
    const selected = Array.from(list.querySelectorAll('.uid-item.selected')).map(x => x.dataset.pool);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    close();
    // 重新加载当前 UID 的记录，让隐藏生效
    const uid = document.querySelector('.selected-display')?.textContent;
    if (uid && uid !== '请先刷新数据') {
      await loadGachaRecords(uid);
      applyHiddenPools(); // 见下方
    }
    animationMessage(true, '已应用隐藏卡池设置');
  };
}

function getHiddenPools() {
  const STORAGE_KEY = 'genshin_hidden_pools';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = JSON.parse(raw || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    localStorage.removeItem('genshin_hidden_pools');
    return new Set();
  }
}

async function openDeleteByTimeModal() {
  const modal = document.getElementById('deleteByTimeModal');
  const closeBtn = document.getElementById('closeDeleteByTimeModal');
  const cancelBtn = document.getElementById('cancelDeleteByTime');
  const confirmBtn = document.getElementById('confirmDeleteByTime');

  const uid = document.querySelector('.selected-display')?.textContent?.trim();
  if (!uid || uid === '请先刷新数据') {
    animationMessage(false, '请先选择 UID 并刷新数据后再使用该功能');
    return;
  }

  // 拉取记录并过滤当前 uid
  const all = await window.electronAPI.invoke('get-genshin-gacha-records');
  const records = all.filter(r => r.uid === uid);

  // UI 填充
  document.getElementById('deleteByTimeUidText').textContent = uid;
  document.getElementById('deleteByTimeTotalText').textContent = records.length;

  // 计算最早/最晚
  const times = records.map(parseRecordTime).filter(Boolean).sort((a,b)=>a-b);
  if (!times.length) {
    document.getElementById('deleteByTimeRangeText').textContent = '无法解析记录时间（请检查记录的时间字段）';
  } else {
    const minT = times[0];
    const maxT = times[times.length - 1];
    document.getElementById('deleteByTimeRangeText').textContent =
      `${minT.toLocaleString()}  ~  ${maxT.toLocaleString()}`;

    // 默认填满范围
    const startInput = document.getElementById('deleteStartTime');
    const endInput = document.getElementById('deleteEndTime');
    startInput.value = toDatetimeLocalValue(minT);
    endInput.value = toDatetimeLocalValue(maxT);

    // 限制可选范围（防止选到范围外）
    startInput.min = toDatetimeLocalValue(minT);
    startInput.max = toDatetimeLocalValue(maxT);
    endInput.min = toDatetimeLocalValue(minT);
    endInput.max = toDatetimeLocalValue(maxT);
  }

  // 打开 modal
  modal.style.display = 'flex';

  const close = () => (modal.style.display = 'none');
  closeBtn.onclick = close;
  cancelBtn.onclick = close;

  confirmBtn.onclick = async () => {
    const startStr = document.getElementById('deleteStartTime').value;
    const endStr = document.getElementById('deleteEndTime').value;

    if (!startStr || !endStr) {
      animationMessage(false, '请选择起始时间与结束时间');
      return;
    }

    const start = new Date(startStr);
    const end = new Date(endStr);
    start.setSeconds(0, 0);
    end.setSeconds(59, 999);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      animationMessage(false, '时间格式无效');
      return;
    }
    if (start > end) {
      animationMessage(false, '起始时间不能晚于结束时间');
      return;
    }

    const preview = await window.electronAPI.invoke('count-gacha-records-by-time', {
  uid,
  start: start.toISOString(),
  end: end.toISOString(),
  table: 'genshin_gacha',
});

    const first = confirm(
      `确定要删除 UID:${uid} 在该时间范围内的抽卡记录吗？\n` +
      `${start.toLocaleString()} ~ ${end.toLocaleString()}\n` +
      `预计删除：${preview.count} 条`
    );
    if (!first) return;
    const second = confirm('再次确认：此操作不可撤销，仍要继续删除吗？');
    if (!second) return;

    try {
        const res = await window.electronAPI.invoke('delete-gacha-records-by-time', {
          uid,
          start: start.toISOString(),
          end: end.toISOString(),
          table: 'genshin_gacha',
        });

        animationMessage(res.success, res.message);
        if (res.success) {
          await loadGachaRecords(uid);
          applyHiddenPools();
        }
    } catch (err) {
      animationMessage(false, `删除失败: ${err.message}`);
    }
  };
}



// 暴露初始化函数
window.gachaGenshinInit = gachaGenshinInit;
