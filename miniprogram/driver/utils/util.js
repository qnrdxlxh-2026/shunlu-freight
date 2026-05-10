/**
 * 工具函数
 */

/**
 * 格式化金额，保留2位小数
 */
function formatAmount(amount) {
  if (amount == null) return '0.00';
  return parseFloat(amount).toFixed(2);
}

/**
 * 格式化日期时间
 */
function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

/**
 * 格式化日期（不含时间）
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 格式化时间（不含日期）
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * 相对时间描述（刚刚、几分钟前、几小时前）
 */
function relativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return formatDate(timestamp);
}

/**
 * 验证手机号
 */
function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证密码（6位以上）
 */
function validatePassword(pwd) {
  return pwd && pwd.length >= 6;
}

/**
 * 获取订单状态文字
 */
function getOrderStatusText(status) {
  const map = {
    1: '待支付',
    2: '待取货',
    3: '配送中',
    4: '已完成',
    5: '已取消'
  };
  return map[status] || '未知';
}

/**
 * 获取订单状态样式类
 */
function getOrderStatusClass(status) {
  const map = {
    1: 'badge-orange',
    2: 'badge-orange',
    3: 'badge-blue',
    4: 'badge-green',
    5: 'badge-red'
  };
  return map[status] || 'badge-orange';
}

/**
 * 获取司机类型文字
 */
function getDriverTypeText(role) {
  return role == 2 ? '货车司机' : role == 3 ? '私家车主' : '未知';
}

/**
 * 获取司机类型样式
 */
function getDriverTypeClass(role) {
  return role == 2 ? 'tag-truck' : role == 3 ? 'tag-private' : '';
}

/**
 * 计算匹配度星级
 */
function getMatchStars(score) {
  if (!score) return 0;
  if (score >= 90) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

/**
 * 节流函数
 */
function throttle(fn, delay = 500) {
  let timer = null;
  return function (...args) {
    if (timer) return;
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 显示加载提示
 */
function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true });
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示成功提示并跳转
 */
function showSuccessAndBack(title = '操作成功', delta = 1) {
  wx.showToast({ title, icon: 'success', duration: 1500 });
  setTimeout(() => wx.navigateBack({ delta }), 1500);
}

/**
 * 显示成功提示
 */
function showSuccess(title = '操作成功') {
  wx.showToast({ title, icon: 'success', duration: 1500 });
}

/**
 * 显示失败提示
 */
function showError(title = '操作失败') {
  wx.showToast({ title, icon: 'none', duration: 2000 });
}

module.exports = {
  formatAmount,
  formatDateTime,
  formatDate,
  formatTime,
  relativeTime,
  validatePhone,
  validatePassword,
  getOrderStatusText,
  getOrderStatusClass,
  getDriverTypeText,
  getDriverTypeClass,
  getMatchStars,
  throttle,
  showLoading,
  hideLoading,
  showSuccessAndBack,
  showSuccess,
  showError
};
