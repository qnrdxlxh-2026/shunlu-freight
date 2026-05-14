const app = getApp();
const api = require('../../utils/api.js');
const { getOrderStatusText, getOrderStatusClass, formatAmount } = require('../../utils/util.js');

Page({
  data: {
    tabs: ['全部', '待支付', '待取货', '运输中', '已签收'],
    tabIndex: 0,
    orders: [],
    loading: true
  },

  onShow() {
    if (!app.globalData.token && !wx.getStorageSync('token')) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
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
      const res = await app.get('/api/personal/orders');
      let orders = [];
      if (res && res.data) {
        // 兼容两种格式：{ list: [] } 或直接是 []
        orders = Array.isArray(res.data) ? res.data : (res.data.list || []);
      }
      orders = orders.map(o => ({
        ...o,
        statusText: getOrderStatusText(o.status),
        statusClass: getOrderStatusClass(o.status),
        amount: formatAmount(o.price)
      }));
      this.setData({ orders, loading: false });
    } catch (err) {
      if (err.message === '未登录') {
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  }
});
