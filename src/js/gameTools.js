function gameToolsInit() {
    const toolList = document.getElementById('tool-list');
    const subpageContent = document.getElementById('subpage-content');
    const globalBackButton = document.getElementById('global-back-button'); // 全局返回按钮

    // 工具卡片点击事件
    toolList.addEventListener('click', (e) => {
        if (e.target.classList.contains('tool-card')) {
            const toolPage = e.target.dataset.tool;

            // 动态加载工具子页面
            loadToolSubpage(toolPage);

            // 隐藏工具列表，显示子页面区域
            toolList.classList.remove('visible');
            toolList.classList.add('hidden');

            subpageContent.classList.remove('hidden');
            subpageContent.classList.add('visible');

            globalBackButton.classList.remove('hidden');
            globalBackButton.classList.add('visible');
        }
    });

    // 返回按钮事件
    globalBackButton.addEventListener('click', () => {
        const loadedScripts = document.querySelectorAll('script[data-tool]');
        // 隐藏子页面，显示工具列表
        subpageContent.classList.remove('visible');
        subpageContent.classList.add('hidden');

        toolList.classList.remove('hidden');
        toolList.classList.add('visible');

        globalBackButton.classList.remove('visible');
        globalBackButton.classList.add('hidden');
        // 清空子页面内容
        subpageContent.innerHTML = '';
        loadedScripts.forEach(script => script.remove());
    });

    // document.getElementById('getStarRailRecords').addEventListener('click', async () => {
    //     document.getElementById('getStarRailRecords').disabled = true;
    //     document.getElementById('getStarRailRecords').innerText = '请等待...';
    //     try {
    //         result = await window.electronAPI.invoke('getZZZLink');
    //         animationMessage(result.success, result.message);
    //     } catch (error) {
    //         animationMessage(false, error);
    //         console.error('发生错误:', error);
    //     } finally {
    //         document.getElementById('getStarRailRecords').disabled = false;
    //         document.getElementById('getStarRailRecords').innerText = '获取崩铁记录';
    //     }
    // });
}

// 动态加载工具子页面内容
function loadToolSubpage(toolPage) {
    const subpageContent = document.getElementById('subpage-content');

    console.log('Loading tool page:', toolPage);
    subpageContent.classList.add('fade-out');

    setTimeout(() => {
        subpageContent.innerHTML = '';
        fetch(`pages/gameTools/${toolPage}.html`)
            .then(response => {
                if (!response.ok) {
                    animationMessage(false, `页面错误: ${response.status}`);
                    throw new Error(`页面错误: ${response.status}`);
                }
                return response.text();
            })
            .then(html => {
                subpageContent.innerHTML = html; // 插入子页面内容
                loadToolScript(toolPage);
                subpageContent.classList.remove('fade-out');
                subpageContent.classList.add('fade-in');
                setTimeout(() => subpageContent.classList.remove('fade-in'), 300);
            })
            .catch(error => {
                animationMessage(false, `${toolPage}加载失败`);
                console.error(`Failed to load tool page: ${error}`);
            });
    }, 200);
}

const handleExport = async (gameType, getUidListChannel, exportDataChannel) => {
        const modal = document.getElementById('uidSelectionModal');
        const uidListContainer = document.getElementById('uidListContainer');
        const confirmButton = document.getElementById('confirmUIDSelection');
        const closeButton = document.getElementById('closeModal');
        const selectAllButton = document.getElementById('selectAllUIDs');
        const deselectAllButton = document.getElementById('deselectAllUIDs');

        // 重置模态窗口状态
        const resetModal = () => {
            uidListContainer.innerHTML = ''; // 清空 UID 列表
            document.querySelectorAll('.uid-item').forEach(item => item.remove()); // 清理旧的 UID 项
            // 解除绑定事件监听器（通过克隆替换，确保解绑）
            confirmButton.replaceWith(confirmButton.cloneNode(true));
            closeButton.replaceWith(closeButton.cloneNode(true));
            selectAllButton.replaceWith(selectAllButton.cloneNode(true));
        };

        try {
            const uidList = await window.electronAPI.invoke(getUidListChannel);
            if (uidList.length === 0) {
                animationMessage(false, `没有找到可导出的 ${gameType} UID`);
                return;
            }
            resetModal(); // 确保模态窗口处于初始状态
            // 动态生成 UID 列表
            uidList.forEach(uid => {
                const uidItem = document.createElement('div');
                uidItem.className = 'uid-item';
                uidItem.innerText = uid;
                uidItem.dataset.uid = uid;
                uidListContainer.appendChild(uidItem);
                uidItem.addEventListener('click', () => {
                    uidItem.classList.toggle('selected');
                    updateToggleButtonState();
                });
            });
            // 打开模态窗口
            openModal(modal);
            // 全选功能
            // 替换全选按钮并绑定事件
            const toggleSelectAllButton = document.getElementById('selectAllUIDs');
            toggleSelectAllButton.replaceWith(toggleSelectAllButton.cloneNode(true));
            const newSelectAllButton = document.getElementById('selectAllUIDs');
            // 全选/取消全选功能
            newSelectAllButton.addEventListener('click', () => {
                const uidItems = document.querySelectorAll('.uid-item');
                const isAllSelected = Array.from(uidItems).every(item => item.classList.contains('selected'));
                if (isAllSelected) {
                    // 如果已全选，执行取消全选
                    uidItems.forEach(item => item.classList.remove('selected'));
                    newSelectAllButton.classList.remove('primary');
                    newSelectAllButton.innerText = '全选';
                } else {
                    // 如果未全选，执行全选
                    uidItems.forEach(item => item.classList.add('selected'));
                    newSelectAllButton.classList.add('primary');
                    newSelectAllButton.innerText = '取消全选';
                }
            });

            // 更新全选按钮文字
            const updateToggleButtonState = () => {
                const uidItems = document.querySelectorAll('.uid-item');
                const allSelected = Array.from(uidItems).every(item => item.classList.contains('selected'));
                if (allSelected) {
                    newSelectAllButton.classList.add('primary');
                    newSelectAllButton.innerText = '取消全选';
                }else{
                    newSelectAllButton.classList.remove('primary');
                    newSelectAllButton.innerText = '全选';
                }
            };
            // 确认选择
            document.getElementById('confirmUIDSelection').addEventListener('click', async () => {
                const selectedUIDs = Array.from(document.querySelectorAll('.uid-item.selected')).map(
                    item => item.dataset.uid
                );
                if (selectedUIDs.length === 0) {
                    animationMessage(false, `未选择任何 ${gameType} UID`);
                    return;
                }
                closeModal(modal);
                document.getElementById(`export${gameType}`).disabled = true;
                document.getElementById(`export${gameType}`).innerText = '请等待...';
                try {
                    await window.electronAPI.invoke(exportDataChannel, selectedUIDs);
                } catch (error) {
                    animationMessage(false, `导出 ${gameType} 数据失败\n${error.message}`);
                } finally {
                    document.getElementById(`export${gameType}`).disabled = false;
                    newSelectAllButton.classList.remove('primary');
                    newSelectAllButton.innerText = '全选';
                    document.getElementById(`export${gameType}`).innerText = '导出数据';
                }
            });

            // 关闭模态窗口
            document.getElementById('closeModal').addEventListener('click', () => {
                closeModal(modal);
            });
        } catch (error) {
            animationMessage(false, `获取 ${gameType} UID 列表失败\n${error.message}`);
        }
};


// 动态加载工具子页面的 JS 文件
function loadToolScript(toolPage) {
    const script = document.createElement("script");
    script.src = `js/gameTools/${toolPage}.js`;
    script.dataset.tool = toolPage;
    script.onload = () => {
        if (typeof window[`${toolPage}Init`] === 'function') {
            window[`${toolPage}Init`]();
        }
    };
    document.body.appendChild(script);
}

// 注册初始化函数
window.gameToolsInit = gameToolsInit;
