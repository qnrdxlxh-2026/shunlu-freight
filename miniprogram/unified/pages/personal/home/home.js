const app = getApp();
const api = require('../../../utils/api.js');
const { getOrderStatusText, formatDate } = require('../../../utils/util.js');

Page({
  data: {
    userInfo: {},
    stats: { pending: 0, transit: 0, done: 0 },
    latestOrders: []
  },

  async onShow() {
    // 登录检查
    if (!app.globalData.token) {
      wx.redirectTo({ url: '/pages/login/login?role=5' });
      return;
    }

    // 初始化自定义TabBar
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().init();
      const pages = getCurrentPages();
      const currentPath = "/" + pages[pages.length - 1].route;
      const list = this.getTabBar().data.list;
      const idx = list.findIndex(item => item.pagePath === currentPath);
      this.getTabBar().setData({ selected: idx >= 0 ? idx : 0 });
    }

    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};

    this.setData({ userInfo });
    await this.loadData();
  },

  async loadData() {
    try {
      const [userRes, ordersRes] = await Promise.all([
        api.getUserInfo(),
        api.getPersonalOrders()
      ]);

      const orders = Array.isArray(ordersRes.data) ? ordersRes.data
        : (ordersRes.data && Array.isArray(ordersRes.data.list)) ? ordersRes.data.list : [];
      const statusCount = (arr, status) => arr.filter(o => o.status === status).length;

      console.log('loadData成功 userRes=', JSON.stringify(userRes.data), 'ordersRes=', JSON.stringify(ordersRes.data));
      this.setData({
        userInfo: userRes.data || app.globalData.userInfo || {},
        stats: {
          pending: statusCount(orders, 'pending'),
          transit: statusCount(orders, 'transit'),
          done: statusCount(orders, 'done')
        },
        latestOrders: orders.slice(0, 3).map(o => ({
          ...o,
          statusText: getOrderStatusText(o.status),
          createTime: formatDate(o.createTime, 'MM-DD HH:mm')
        }))
      });
    } catch (e) {
      if (e.message === '未登录') {
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      console.error('loadData error', e);
    }
  },

  goSendPackage() { wx.navigateTo({ url: '/pages/personal/send-package/send-package' }); },
  goFindDrivers() { wx.navigateTo({ url: '/pages/personal/find-drivers/find-drivers' }); },
  goMyPackages() { wx.navigateTo({ url: '/pages/personal/my-packages/my-packages' }); },
  goWallet() { wx.reLaunch({ url: '/pages/personal/wallet/wallet' }); },
  goOrders(e) {
    // orders 是 TabBar 页面，必须用 switchTab，不能传参数
    wx.reLaunch({ url: '/pages/personal/orders/orders' });
  },
  goOrderDetail(e) {
    wx.navigateTo({ url: '/pages/personal/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  }
});
