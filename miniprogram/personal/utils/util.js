/**
 * 工具函数
 */

function formatAmount(amount) {
  if (amount == null) return '0.00';
  return parseFloat(amount).toFixed(2);
}

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

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getOrderStatusText(status) {
  const map = { 1: '待支付', 2: '待取货', 3: '运输中', 4: '已签收', 5: '已取消' };
  return map[status] || '未知';
}

function getOrderStatusClass(status) {
  const map = { 1: 'badge-orange', 2: 'badge-orange', 3: 'badge-blue', 4: 'badge-green', 5: 'badge-red' };
  return map[status] || 'badge-orange';
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

module.exports = {
  formatAmount,
  formatDateTime,
  formatDate,
  getOrderStatusText,
  getOrderStatusClass,
  validatePhone
};
