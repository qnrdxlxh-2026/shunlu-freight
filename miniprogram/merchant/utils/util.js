/**
 * 通用工具函数
 */

/**
 * 格式化时间
 * @param {string|number|Date} date 日期
 * @param {string} fmt 格式化模板，默认 YYYY-MM-DD HH:mm
 */
const formatTime = (date, fmt = 'YYYY-MM-DD HH:mm') => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  const second = pad(d.getSeconds());
  
  return fmt
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
};

/**
 * 格式化金额（保留两位小数）
 * @param {number} amount 金额
 */
const formatMoney = (amount) => {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(2);
};

/**
 * 订单状态映射
 */
const orderStatusMap = {
  0: { text: '待支付', className: 'status-wait-pay' },
  1: { text: '待取货', className: 'status-wait-pick' },
  2: { text: '配送中', className: 'status-delivering' },
  3: { text: '已完成', className: 'status-completed' },
  4: { text: '已取消', className: 'status-cancelled' }
};

/**
 * 获取订单状态文本
 * @param {number} status 状态码
 */
const getOrderStatusText = (status) => {
  return orderStatusMap[status] ? orderStatusMap[status].text : '未知';
};

/**
 * 获取订单状态样式类名
 * @param {number} status 状态码
 */
const getOrderStatusClass = (status) => {
  return orderStatusMap[status] ? orderStatusMap[status].className : '';
};

/**
 * 手机号验证
 * @param {string} phone 手机号
 */
const isValidPhone = (phone) => {
  return /^1[3-9]\d{9}$/.test(phone);
};

/**
 * 防抖函数
 * @param {Function} fn 回调函数
 * @param {number} delay 延迟时间（毫秒）
 */
const debounce = (fn, delay = 500) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

/**
 * 显示加载中
 */
const showLoading = (title = '加载中...') => {
  wx.showLoading({ title, mask: true });
};

/**
 * 隐藏加载中
 */
const hideLoading = () => {
  wx.hideLoading();
};

/**
 * 显示成功提示
 */
const showSuccess = (title = '操作成功') => {
  wx.showToast({ title, icon: 'success', duration: 1500 });
};

/**
 * 显示错误提示
 */
const showError = (msg = '操作失败') => {
  wx.showToast({ title: msg, icon: 'none', duration: 2000 });
};

/**
 * 确认弹窗
 */
const showConfirm = (content, title = '提示') => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        if (res.confirm) resolve(true);
        else resolve(false);
      },
      fail: reject
    });
  });
};

module.exports = {
  formatTime,
  formatMoney,
  getOrderStatusText,
  getOrderStatusClass,
  isValidPhone,
  debounce,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showConfirm
};