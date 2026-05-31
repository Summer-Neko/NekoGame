function getDrawColorMiliastra(draws, quality, config) {
    if (quality === config.high) {
        if (draws <= 35) return '#3399ff'; // 蓝色
        if (draws <= 60) return '#33cc33'; // 绿色
        return '#ff6666'; // 红色
    }
    if (quality === config.mid) {
        if (config.midPity === 10) {
            if (draws <= 3) return '#3399ff';
            if (draws <= 7) return '#33cc33';
            return '#ff6666';
        } else { // 针对常驻池的 5 抽保底
            if (draws <= 2) return '#3399ff';
            if (draws <= 4) return '#33cc33';
            return '#ff6666';
        }
    }
    return '#aaa'; // 默认灰色
}


function getColorByQualityMiliastra(quality) {
    if (quality === 5) return '#f3d58a';
    if (quality === 4) return '#d6c7ff';
    if (quality === 3) return '#6699ff';
    return '#75fb81';
}

function renderPieChartMiliastra(records, poolType, config) {
    const chartId = `star-pie-chart-${poolType}`;
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // 动态构建饼图所需的数据项
    const starCounts = {};
    const backgroundColors = [];

    // 如果是活动池 (最高5星)
    if (config.high === 5) {
        starCounts["五星"] = records.filter(r => r.quality_level === 5).length;
        starCounts["四星"] = records.filter(r => r.quality_level === 4).length;
        starCounts["三星"] = records.filter(r => r.quality_level === 3).length;
        backgroundColors.push("rgba(243, 213, 138, 0.8)", "rgba(214, 199, 255, 0.8)", "rgba(112, 158, 250, 0.8)");
    }
    // 如果是常驻池 (最高4星)
    else {
        starCounts["四星"] = records.filter(r => r.quality_level === 4).length;
        starCounts["三星"] = records.filter(r => r.quality_level === 3).length;
        starCounts["二星"] = records.filter(r => r.quality_level === 2).length;
        // 把 4星的紫色 放在第一个，3星蓝色放第二个，2星绿色放第三个
        backgroundColors.push("rgba(214, 199, 255, 0.8)", "rgba(112, 158, 250, 0.8)", "rgba(117, 251, 129, 0.81)");
    }

    const chartData = {
        labels: Object.keys(starCounts),
        datasets: [{ data: Object.values(starCounts), backgroundColor: backgroundColors }],
    };

    // 底部文字提示 HTML 也动态生成
    const keys = Object.keys(starCounts);
    const starInfoHtml = `
        <div class="star-info">
            <span class="star-five" data-index="0">${starCounts[keys[0]]}</span> |
            <span class="star-four" data-index="1">${starCounts[keys[1]]}</span> |
            <span class="star-three" data-index="2">${starCounts[keys[2]]}</span>
        </div>
        <div class="date-range">${records[records.length - 1]?.timestamp.split(' ')[0]} - ${records[0]?.timestamp.split(' ')[0]}</div>
    `;
    // 插入到饼状图下方
    canvas.insertAdjacentHTML('afterend', starInfoHtml);

    // 初始化图表并存储实例
    charts[poolType] = new Chart(ctx, {
        type: "doughnut", // 使用 doughnut 类型
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false, // 隐藏默认标签
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.raw || 0;
                            return `${value} 抽`;
                        },
                    },
                },
            },
            animation: {
                duration: 1000,
                animateScale: true,
                animateRotate: true,
            },
        },
    });

    // 为每个数字绑定点击事件
    const starElements = canvas.nextElementSibling.querySelectorAll('.star-info span');
    starElements.forEach((element) => {
        element.addEventListener('click', function () {
            const index = this.dataset.index; // 获取对应数据索引
            const meta = charts[poolType].getDatasetMeta(0); // 获取当前卡池图表的元数据
            meta.data[index].hidden = !meta.data[index].hidden; // 切换数据可见性
            charts[poolType].update(); // 更新当前图表
        });
    });
}

// 生成概览和详细列表
function generateOverviewMiliastra(records, config) {
    // 根据当前卡池配置过滤最高星级（活动过滤5星，常驻过滤4星）
    const highStarRecords = records.filter(r => r.quality_level === config.high);

    return highStarRecords.map((record, index) => {
        const nextIndex = index + 1 < highStarRecords.length
            ? records.indexOf(highStarRecords[index + 1])
            : records.length;

        const draws = nextIndex - records.indexOf(record);
        const color = getDrawColorMiliastra(draws, record.quality_level, config);
        const isOffBanner = isOffBanners(record, commonItems);
        return `
            <div class="record"
                data-name="${record.name}"
                data-time="${record.timestamp || '未知时间'}"
                data-draws="${draws}"
                data-color="${getColorByQualityMiliastra(record.quality_level)}"
                data-offbanner="${isOffBanner ? 'true' : 'false'}">
                <span class="record-star gold">${record.quality_level} 星</span>
                <span class="record-name" style="color: ${getColorByQualityMiliastra(record.quality_level)};">${record.name}</span>
                <span class="record-draws-with-off-banner">
                    ${isOffBanner ? `<span class="record-off-banner" title="常驻角色">歪</span>` : ""}
                    <span class="record-draws" style="color: ${color};">${draws} 抽</span>
                </span>
            </div>
        `;
    }).join('');
}

function generateDetailsMiliastra(records, config) {
    const groupedRecords = groupRecordsByDate(records);
    const highStarRecords = records.filter(r => r.quality_level === config.high);
    const midStarRecords = records.filter(r => r.quality_level === config.mid);

    return Object.keys(groupedRecords).map(date => {
        const recordsForDate = groupedRecords[date];
        return `
            <div class="record-date-group">
                <div class="record-date">${date}</div>
                ${recordsForDate.map(record => {
                    let draws = '';
                    if (record.quality_level === config.high) {
                        const currentIndex = records.indexOf(record);
                        const nextIndex = highStarRecords.find(r => records.indexOf(r) > currentIndex);
                        draws = nextIndex ? records.indexOf(nextIndex) - currentIndex : records.length - currentIndex;
                    } else if (record.quality_level === config.mid) {
                        const currentIndex = records.indexOf(record);
                        const nextIndex = midStarRecords.find(r => records.indexOf(r) > currentIndex);
                        draws = nextIndex ? records.indexOf(nextIndex) - currentIndex : records.length - currentIndex;
                    }

                    const color = getDrawColorMiliastra(draws, record.quality_level, config);
                    const isOffBanner = isOffBanners(record, commonItems);

                    return `
                        <div class="record"
                            data-name="${record.name}"
                            data-time="${record.timestamp || '未知时间'}"
                            data-draws="${draws || '-'}"
                            data-color="${getColorByQualityMiliastra(record.quality_level)}"
                            data-offbanner="${isOffBanner ? 'true' : 'false'}">
                            <span class="record-star" style="color: ${getColorByQualityMiliastra(record.quality_level)};">
                                ${record.quality_level} 星
                            </span>
                            <span class="record-name" style="color: ${getColorByQualityMiliastra(record.quality_level)};">
                                ${record.name}
                            </span>
                            ${draws ? `
                                <span class="record-draws-with-off-banner">
                                    ${isOffBanner ? `<span class="record-off-banner" title="常驻角色">歪</span>` : ""}
                                    <span class="record-draws" style="color: ${color};">${draws} 抽</span>
                                </span>` : ""}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

function initRecordListTabsMiliastra(records, poolSection, config) {
    const tabs = poolSection.querySelectorAll('.record-list-tabs .record-tab');
    const recordList = poolSection.querySelector('.record-list');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (tab.dataset.tab === 'overview') {
                applySlideInAnimation(recordList, generateOverviewMiliastra(records, config)); // 加上 config
                initRecordTooltips();
            } else if (tab.dataset.tab === 'details') {
                applySlideInAnimation(recordList, generateDetailsMiliastra(records, config)); // 加上 config
                initRecordTooltips();
            }
        });
    });
}

// 根据五星平均抽数返回评价
function getRatingMiliastra(avg, avgUpText = null) {
    // 检查数据有效性
    if (avg === "无数据") return "无数据";
    if (avgUpText === "无数据" || avgUpText === null) {
        if (avg <= 15) return "万里挑一至尊欧皇";
        if (avg <= 30) return "万里挑一欧皇";
        if (avg <= 45) return "尊贵欧皇";
        if (avg <= 53) return "薛定谔的欧皇";
        if (avg <= 60) return "欧非守恒";
        if (avg <= 63) return "薛定谔的非酋";
        if (avg <= 66) return "绝世非酋";
        if (avg <= 68) return "万里挑一非酋";
        return "万里挑一绝世非酋";
    }
    // 如果有数据，则以平均up数判断欧非
    if (avgUpText <= 20) return "万里挑一至臻欧皇";
    if (avgUpText <= 35) return "万里挑一至尊欧皇";
    if (avgUpText <= 45) return "万里挑一欧皇";
    if (avgUpText <= 55) return "至臻欧皇";
    if (avgUpText <= 75) return "至尊欧皇";
    if (avgUpText <= 85) return "薛定谔的欧皇";
    if (avgUpText <= 95) return "欧非守恒";
    if (avgUpText <= 115) return "薛定谔的非酋";
    if (avgUpText <= 125) return "绝世非酋";
    if (avgUpText <= 135) return "万里挑一非酋";
    return "万里挑一绝世非酋";
}
