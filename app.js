import { db, SALES_COLLECTION } from './firebase-config.js';

// DOM 元素
const salesForm = document.getElementById('salesForm');
const dateInput = document.getElementById('date');
const wechatAddsInput = document.getElementById('wechatAdds');
const samplesInput = document.getElementById('samples');
const salesInput = document.getElementById('sales');
const recentDataBody = document.getElementById('recentDataBody');
const monthlyDataBody = document.getElementById('monthlyDataBody');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastMessage = document.getElementById('toastMessage');
const initialLoading = document.querySelector('.initial-loading');
const currentDateElement = document.getElementById('currentDate');
const todayWechatElement = document.getElementById('todayWechat');
const todaySamplesElement = document.getElementById('todaySamples');
const todaySalesElement = document.getElementById('todaySales');

// Bootstrap Toast 实例
const toastInstance = new bootstrap.Toast(toast);

// 更新当前日期显示
function updateCurrentDate() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    currentDateElement.textContent = now.toLocaleDateString('zh-CN', options);
}

// 更新今日数据显示
async function updateTodayStats() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const firstDayFormatted = formatDateForInput(firstDayOfMonth);
    const lastDayFormatted = formatDateForInput(lastDayOfMonth);
    
    try {
        const snapshot = await db.collection(SALES_COLLECTION)
            .where('date', '>=', firstDayFormatted)
            .where('date', '<=', lastDayFormatted)
            .get();

        let totalWechat = 0;
        let totalSamples = 0;
        let totalSales = 0;

        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const data = doc.data();
                totalWechat += data.wechatAdds;
                totalSamples += data.samples;
                totalSales += data.sales;
            });
        }
        
        todayWechatElement.textContent = totalWechat;
        todaySamplesElement.textContent = totalSamples;
        todaySalesElement.textContent = `¥${totalSales.toFixed(2)}`;
    } catch (error) {
        console.error('获取月度数据时出错:', error);
        todayWechatElement.textContent = '0';
        todaySamplesElement.textContent = '0';
        todaySalesElement.textContent = '¥0.00';
    }
}

// 页面加载时设置默认日期为今天
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const formattedDate = formatDateForInput(today);
    dateInput.value = formattedDate;
    
    // 更新当前日期显示
    updateCurrentDate();
    
    // 加载数据
    loadData().then(() => {
        // 更新今日统计
        updateTodayStats();
        
        // 数据加载完成后，淡出初始加载动画
        setTimeout(() => {
            initialLoading.classList.add('fade-out');
            setTimeout(() => {
                initialLoading.style.display = 'none';
            }, 500);
        }, 800);
    });
});

// 表单提交处理
salesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 获取表单数据
    const date = dateInput.value;
    const wechatAdds = parseInt(wechatAddsInput.value);
    const samples = parseInt(samplesInput.value);
    const sales = parseFloat(salesInput.value);
    
    // 检查日期是否已存在数据
    try {
        showLoading();
        
        const dateExists = await checkDateExists(date);
        if (dateExists) {
            // 询问用户是否要更新
            if (confirm('该日期已有数据记录，是否要更新？')) {
                await updateSalesData(date, wechatAdds, samples, sales);
                showToast('成功', '数据已更新');
            }
        } else {
            // 添加新数据
            await addSalesData(date, wechatAdds, samples, sales);
            showToast('成功', '数据已保存');
        }
        
        // 重新加载数据
        await loadData();
        // 更新今日统计
        await updateTodayStats();
        
        // 重置表单
        salesForm.reset();
        dateInput.value = formatDateForInput(new Date());
    } catch (error) {
        console.error('保存数据时出错:', error);
        showToast('错误', '保存数据失败: ' + error.message);
    } finally {
        hideLoading();
    }
});

// 检查日期是否已存在数据
async function checkDateExists(date) {
    const snapshot = await db.collection(SALES_COLLECTION)
        .where('date', '==', date)
        .get();
    return !snapshot.empty;
}

// 添加新数据
async function addSalesData(date, wechatAdds, samples, sales) {
    return db.collection(SALES_COLLECTION).add({
        date: date,
        wechatAdds: wechatAdds,
        samples: samples,
        sales: sales,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        // 更新本月统计
        updateTodayStats();
    });
}

// 更新销售数据
async function updateSalesData(date, wechatAdds, samples, sales) {
    const snapshot = await db.collection(SALES_COLLECTION)
        .where('date', '==', date)
        .get();
    
    if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        return db.collection(SALES_COLLECTION).doc(docId).update({
            wechatAdds: wechatAdds,
            samples: samples,
            sales: sales,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            // 更新本月统计
            updateTodayStats();
        });
    }
}

// 删除销售数据
async function deleteSalesData(docId) {
    if (confirm('确定要删除这条数据吗？')) {
        try {
            showLoading();
            await db.collection(SALES_COLLECTION).doc(docId).delete();
            showToast('成功', '数据已删除');
            await loadData();
            // 更新本月统计
            await updateTodayStats();
        } catch (error) {
            console.error('删除数据时出错:', error);
            showToast('错误', '删除数据失败: ' + error.message);
        } finally {
            hideLoading();
        }
    }
}

// 加载数据
async function loadData() {
    try {
        showLoading();
        
        // 加载近3天数据
        await loadRecentData();
        
        // 加载月度统计数据
        await loadMonthlyData();
    } catch (error) {
        console.error('加载数据时出错:', error);
        showToast('错误', '加载数据失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 加载近3天数据
async function loadRecentData() {
    // 清空表格
    recentDataBody.innerHTML = '';
    
    // 获取所有数据并按日期排序
    const snapshot = await db.collection(SALES_COLLECTION)
        .orderBy('date', 'desc')
        .get();
    
    if (snapshot.empty) {
        recentDataBody.innerHTML = '<tr><td colspan="5" class="text-center">暂无数据</td></tr>';
        return;
    }
    
    // 显示最近的数据（最多3条）
    const limit = Math.min(snapshot.docs.length, 3);
    for (let i = 0; i < limit; i++) {
        const doc = snapshot.docs[i];
        const data = doc.data();
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(data.date)}</td>
            <td>${data.wechatAdds}</td>
            <td>${data.samples}</td>
            <td>¥${data.sales.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-edit" onclick="editData('${doc.id}')">编辑</button>
                <button class="btn btn-sm btn-delete" onclick="deleteSalesData('${doc.id}')">删除</button>
            </td>
        `;
        
        recentDataBody.appendChild(row);
    }
}

// 编辑数据
async function editData(docId) {
    try {
        showLoading();
        
        // 获取数据
        const doc = await db.collection(SALES_COLLECTION).doc(docId).get();
        if (doc.exists) {
            const data = doc.data();
            
            // 填充表单
            dateInput.value = data.date;
            wechatAddsInput.value = data.wechatAdds;
            samplesInput.value = data.samples;
            salesInput.value = data.sales;
            
            // 滚动到表单
            salesForm.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('获取数据时出错:', error);
        showToast('错误', '获取数据失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 加载月度统计数据
async function loadMonthlyData() {
    // 清空表格
    monthlyDataBody.innerHTML = '';
    
    // 获取所有数据
    const snapshot = await db.collection(SALES_COLLECTION)
        .orderBy('date', 'desc')
        .get();
    
    if (snapshot.empty) {
        monthlyDataBody.innerHTML = '<tr><td colspan="4" class="text-center">暂无数据</td></tr>';
        return;
    }
    
    // 按月份分组统计
    const monthlyStats = {};
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const date = new Date(data.date);
        const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!monthlyStats[monthYear]) {
            monthlyStats[monthYear] = {
                wechatAdds: 0,
                samples: 0,
                sales: 0
            };
        }
        
        monthlyStats[monthYear].wechatAdds += data.wechatAdds;
        monthlyStats[monthYear].samples += data.samples;
        monthlyStats[monthYear].sales += data.sales;
    });
    
    // 显示月度统计数据
    let totalWechatAdds = 0;
    let totalSamples = 0;
    let totalSales = 0;
    
    Object.keys(monthlyStats).sort().reverse().forEach(month => {
        const stats = monthlyStats[month];
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${month}</td>
            <td>${stats.wechatAdds}</td>
            <td>${stats.samples}</td>
            <td>¥${stats.sales.toFixed(2)}</td>
        `;
        
        monthlyDataBody.appendChild(row);
        
        // 累计总数
        totalWechatAdds += stats.wechatAdds;
        totalSamples += stats.samples;
        totalSales += stats.sales;
    });
    
    // 添加总计行
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.innerHTML = `
        <td>总计</td>
        <td>${totalWechatAdds}</td>
        <td>${totalSamples}</td>
        <td>¥${totalSales.toFixed(2)}</td>
    `;
    
    monthlyDataBody.appendChild(totalRow);
}

// 格式化日期为YYYY-MM-DD（用于input元素）
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 格式化日期显示
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 显示加载中遮罩
function showLoading() {
    loadingOverlay.classList.add('active');
}

// 隐藏加载中遮罩
function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// 显示提示消息
function showToast(title, message) {
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toastInstance.show();
}

// 将删除和编辑函数暴露给全局作用域
window.deleteSalesData = deleteSalesData;
window.editData = editData; 