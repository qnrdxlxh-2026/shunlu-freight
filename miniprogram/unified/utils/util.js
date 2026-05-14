/**
 * utils/util.js - 统一工具函数（合并四端）
 */

// ========== 格式化函数 ==========

function formatAmount(amount) {
  if (amount == null) return '0.00';
  return parseFloat(amount).toFixed(2);
}

function formatDate(timestamp, fmt) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  if (fmt) {
    return fmt
      .replace('YYYY', d.getFullYear())
      .replace('MM', pad(d.getMonth() + 1))
      .replace('DD', pad(d.getDate()))
      .replace('HH', pad(d.getHours()))
      .replace('mm', pad(d.getMinutes()))
      .replace('ss', pad(d.getSeconds()));
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(timestamp) {
  return formatDate(timestamp, 'YYYY-MM-DD HH:mm');
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function relativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return formatDate(timestamp);
}

// ========== 验证函数 ==========

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function isValidPhone(phone) {
  return validatePhone(phone);
}

function validatePassword(pwd) {
  return pwd && pwd.length >= 6;
}

// ========== 状态映射 ==========

function getOrderStatusText(status) {
  const map = {
    0: '待支付', 1: '待接单', 2: '待取货', 3: '配送中', 4: '已完成', 5: '已取消', 6: '已签收'
  };
  return map[status] || '未知';
}

function getOrderStatusClass(status) {
  const map = {
    0: 'badge-orange', 1: 'badge-orange', 2: 'badge-blue',
    3: 'badge-blue', 4: 'badge-green', 5: 'badge-red', 6: 'badge-green'
  };
  return map[status] || 'badge-orange';
}

function getDriverTypeText(role) {
  return role == 2 ? '货车司机' : role == 3 ? '私家车主' : '未知';
}

// ========== UI辅助 ==========

function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true });
}

function hideLoading() {
  wx.hideLoading();
}

function showSuccess(title = '操作成功') {
  wx.showToast({ title, icon: 'success', duration: 1500 });
}

function showError(title = '操作失败') {
  wx.showToast({ title, icon: 'none', duration: 2000 });
}

function showConfirm(content, title = '提示') {
  return new Promise(resolve => {
    wx.showModal({
      title, content,
      success: res => resolve(res.confirm)
    });
  });
}

function showSuccessAndBack(title = '操作成功', delta = 1) {
  wx.showToast({ title, icon: 'success', duration: 1500 });
  setTimeout(() => wx.navigateBack({ delta }), 1500);
}

module.exports = {
  formatAmount, formatDate, formatDateTime, formatTime, relativeTime,
  validatePhone, isValidPhone, validatePassword,
  getOrderStatusText, getOrderStatusClass, getDriverTypeText,
  showLoading, hideLoading, showSuccess, showError, showConfirm, showSuccessAndBack
};
