// 判断是否为歪
function isOffBannersZzz(record, commonItems) {
    return (record.card_pool_type === "独家频段" || record.card_pool_type === "音擎频段" )
        && commonItems.includes(record.name);
}

function calculateMostDrawsZzz(records, quality) {
    const qualityRecords = records.filter(r => r.quality_level === quality);
    if (qualityRecords.length === 0) return "暂未抽出S";

    let maxDraws = 0;
    let minDraws = Number.MAX_VALUE;

    qualityRecords.forEach((record, index) => {
        const nextIndex = index + 1 < qualityRecords.length
            ? records.indexOf(qualityRecords[index + 1])
            : records.length;

        const draws = nextIndex - records.indexOf(record);
        maxDraws = Math.max(maxDraws, draws);
        minDraws = Math.min(minDraws, draws);
    });

    return { maxDraws, minDraws };
}


// 计算平均抽卡数
function calculateDrawsBetweenZzz(records, quality) {
    const qualityRecords = records.filter(r => r.quality_level === quality);
    if (qualityRecords.length === 0) return "还没抽出S";
    let totalDraws = 0;
    qualityRecords.forEach((record, index) => {
        const nextIndex = index + 1 < qualityRecords.length
            ? records.indexOf(qualityRecords[index + 1])
            : records.length;
        totalDraws += nextIndex - records.indexOf(record);
    });
    return totalDraws / qualityRecords.length;
}
function calculateUpAverageZzz(records) {
    const upRecords = records.filter(
        r => r.quality_level === 4
        && !commonItems.includes(r.name)
        && (r.card_pool_type === "独家频段" || r.card_pool_type === "音擎频段")
    );
    if (upRecords.length === 0) return "还没抽出UP";
    // 遍历UP角色，累加抽数
    let totalDraws = 0;
    upRecords.forEach((record, index) => {
        const nextIndex = index + 1 < upRecords.length
            ? records.indexOf(upRecords[index + 1]) // 下一个UP角色的索引
            : records.length; // 最后一抽的索引
        totalDraws += nextIndex - records.indexOf(record); // 当前UP角色到下一个UP角色的距离
    });
    return totalDraws / upRecords.length; // 平均UP抽数
}



// 计算不歪概率
function calculateNoDeviationRateZzz(records) {
    const fiveStarRecords = records.filter(r => r.quality_level === 4); // 筛选五星记录

    if (!fiveStarRecords.length) return "无数据"; // 无五星记录

    let noDeviationCount = 0;
    let upCount = 0;

    for (let i = 0; i < fiveStarRecords.length; i++) {
        const record = fiveStarRecords[i];

        // 判断是否为 UP 角色
        const isUpCharacter = !commonItems.includes(record.name);
        if (isUpCharacter) {
            upCount++; // 统计 UP 角色数量

            // 如果是第一个五星角色或者前一个五星也是UP角色
            if (i === 0 || !commonItems.includes(fiveStarRecords[i - 1]?.name)) {
                noDeviationCount++;
            }
        }
    }

    if (upCount === 0) return "还没抽出UP"; // 无UP角色
    return `${((noDeviationCount / upCount) * 100).toFixed(2)}%`; // 返回不歪概率
}


function getQualityLetter(level) {
    switch (level) {
        case 4:
            return 'S';
        case 3:
            return 'A';
        case 2:
            return 'B';
        default:
            return 'C';
    }
}

// 生成概览和详细列表
function generateOverviewZzz(records) {
    const fiveStarRecords = records.filter(r => r.quality_level === 4);

    return fiveStarRecords.map((record, index) => {
        const nextIndex = index + 1 < fiveStarRecords.length
            ? records.indexOf(fiveStarRecords[index + 1])
            : records.length;

        const draws = nextIndex - records.indexOf(record);
        const color = getDrawColorZzz(draws, record.quality_level); // 获取颜色
        // 判断是否为“歪”
        const isOffBanner = isOffBannersZzz(record, commonItems);
        return `
            <div class="record"
                data-name="${record.name}"
                data-time="${record.timestamp || '未知时间'}"
                data-draws="${draws}"
                data-color="${getColorByQualityZzz(record.quality_level)}"
                data-offbanner="${isOffBanner ? 'true' : 'false'}">
                <span class="record-star gold">${getQualityLetter(record.quality_level)} 级</span>
                <span class="record-name" style="color: ${getColorByQualityZzz(record.quality_level)};">${record.name}</span>
                <span class="record-draws-with-off-banner">
                    ${isOffBanner ? `<span class="record-off-banner" title="常驻角色">歪</span>` : ""}
                    <span class="record-draws" style="color: ${color};">${draws} 抽</span>
                </span>
            </div>
        `;
    }).join('');
}
function generateDetailsZzz(records) {
    const groupedRecords = groupRecordsByDate(records); // 按日期分组
    const fiveStarRecords = records.filter(r => r.quality_level === 4); // 筛选五星记录
    const fourStarRecords = records.filter(r => r.quality_level === 3); // 筛选四星记录

    return Object.keys(groupedRecords)
        .map(date => {
            const recordsForDate = groupedRecords[date]; // 获取该日期的所有记录
            return `
                <div class="record-date-group">
                    <div class="record-date">${date}</div>
                    ${recordsForDate.map(record => {
                        let draws = '';

                        if (record.quality_level === 4) {
                            const currentIndex = records.indexOf(record);
                            const nextIndex = fiveStarRecords.find(r => records.indexOf(r) > currentIndex);
                            draws = nextIndex
                                ? records.indexOf(nextIndex) - currentIndex
                                : records.length - currentIndex;
                        } else if (record.quality_level === 3) {
                            const currentIndex = records.indexOf(record);
                            const nextIndex = fourStarRecords.find(r => records.indexOf(r) > currentIndex);
                            draws = nextIndex
                                ? records.indexOf(nextIndex) - currentIndex
                                : records.length - currentIndex;
                        }

                        const color = getDrawColorZzz(draws, record.quality_level); // 获取颜色

                        // 判断是否为“歪”
                        const isOffBanner = isOffBannersZzz(record, commonItems);

                        return `
                            <div class="record"
                                data-name="${record.name}"
                                data-time="${record.timestamp || '未知时间'}"
                                data-draws="${draws || '-'}"
                                data-color="${getColorByQualityZzz(record.quality_level)}"
                                data-offbanner="${isOffBanner ? 'true' : 'false'}">
                                <span class="record-star" style="color: ${getColorByQualityZzz(record.quality_level)};">
                                    ${getQualityLetter(record.quality_level)} 级
                                </span>
                                <span class="record-name" style="color: ${getColorByQualityZzz(record.quality_level)};">
                                    ${record.name}
                                </span>
                                ${
                                    draws
                                        ? `<span class="record-draws-with-off-banner">
                                            ${isOffBanner
                                                ? `<span class="record-off-banner" title="常驻角色">歪</span>`
                                                : ""
                                            }
                                            <span class="record-draws" style="color: ${color};">
                                                ${draws} 抽
                                            </span>
                                        </span>`
                                        : ""
                                }
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        })
        .join('');
}


// 辅助函数
// 根据抽数和质量获取颜色
function getDrawColorZzz(draws, quality) {
    if (quality === 4) {
        if (draws <= 35) return '#3399ff'; // 蓝色
        if (draws <= 67) return '#33cc33'; // 绿色
        return '#ff6666'; // 红色
    }
    if (quality === 3) {
        if (draws <= 3) return '#3399ff'; // 蓝色
        if (draws <= 7) return '#33cc33'; // 绿色
        return '#ff6666'; // 红色
    }
    return '#aaa'; // 默认灰色
}


function getColorByQualityZzz(quality) {
    if (quality === 4) return '#f3d58a';
    if (quality === 3) return '#d6c7ff';
    return '#6699ff';
}


// 生成图表
function renderPieChartZzz(records, poolType) {
    const chartId = `star-pie-chart-${poolType}`;
    const canvas = document.getElementById(chartId);
    if (!canvas) {
        console.error(`Canvas with id ${chartId} not found.`);
        return;
    }

    const ctx = canvas.getContext("2d");

    // 统计星级分布
    const starCounts = {
        "S": records.filter(r => r.quality_level === 4).length,
        "A": records.filter(r => r.quality_level === 3).length,
        "B": records.filter(r => r.quality_level === 2).length,
    };

    // 创建图表数据对象
    const chartData = {
        labels: Object.keys(starCounts),
        datasets: [
            {
                data: Object.values(starCounts),
                backgroundColor: ["rgba(243, 213, 138, 0.8)", "rgba(214, 199, 255, 0.8)", "rgba(112, 158, 250, 0.8)"],
            },
        ],
    };

    // 抽卡时间范围（仅显示到日期）
    const firstRecord = records[0]?.timestamp.split(' ')[0] || "未知";
    const lastRecord = records[records.length - 1]?.timestamp.split(' ')[0] || "未知";
    const dateRange = `${lastRecord} - ${firstRecord}`;

    // 动态生成星级数据块
    const starInfoHtml = `
        <div class="star-info">
            <span class="star-five" data-index="0">${starCounts["S"]}</span> |
            <span class="star-four" data-index="1">${starCounts["A"]}</span> |
            <span class="star-three" data-index="2">${starCounts["B"]}</span>
        </div>
        <div class="date-range">${dateRange}</div>
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
