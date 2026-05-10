const app = getApp();
const api = require('../../utils/api.js');
const { getOrderStatusText, getOrderStatusClass, formatAmount } = require('../../utils/util.js');

Page({
  data: {
    tabs: ['全部', '待取货', '配送中', '已完成'],
    tabIndex: 0,
    orders: [],
    loading: true
  },

  onLoad(options) {
    if (options.status) {
      this.setData({ tabIndex: parseInt(options.status) || 0 });
    }
  },

  onShow() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders().finally(() => wx.stopPullDownRefresh());
  },

  changeTab(e) {
    this.setData({ tabIndex: e.currentTarget.dataset.index });
  },

  async loadOrders() {
    this.setData({ loading: true });
    try {
      const res = await api.getDriverOrders();
      let orders = (res && res.data) || [];
      orders = orders.map(o => ({
        ...o,
        statusText: getOrderStatusText(o.status),
        statusClass: getOrderStatusClass(o.status),
        amount: formatAmount(o.price || o.driver_amount)
      }));
      this.setData({ orders, loading: false });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  }
});
