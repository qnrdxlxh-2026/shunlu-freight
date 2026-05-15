const app = getApp();
const api = require('../../../utils/api.js');
const { getOrderStatusText, getOrderStatusClass, formatAmount } = require('../../../utils/util.js');

Page({
  data: {
    tabs: ['全部', '待支付', '待取货', '运输中', '已签收', '已取消'],
    tabIndex: 0,
    orders: [],
    loading: true
  },

  onShow() {

    // 初始化自定义TabBar
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().init();
      const pages = getCurrentPages();
      const currentPath = "/" + pages[pages.length - 1].route;
      const list = this.getTabBar().data.list;
      const idx = list.findIndex(item => item.pagePath === currentPath);
      this.getTabBar().setData({ selected: idx >= 0 ? idx : 0 });
    }
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
    const tabIndex = e.currentTarget.dataset.index;
    this.setData({ tabIndex });
    this.loadOrders();
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
      // 按tab过滤：0全部, 1待支付(0), 2待取货(2), 3运输中(3), 4已签收(5), 5已取消(6)
      const statusMap = [null, 0, 2, 3, 5, 6];
      const filterStatus = statusMap[this.data.tabIndex];
      if (filterStatus !== null) orders = orders.filter(o => o.status === filterStatus);
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
    wx.navigateTo({ url: '/pages/personal/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  }
});
