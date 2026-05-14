const app = getApp();

Page({
  data: {
    userInfo: null,
    stats: { pending: 0, inProgress: 0, completed: 0 },
    wallet: { balance: 0 }
  },

  onShow() {
    // 登录检查
    if (!app.globalData.token) {
      wx.redirectTo({ url: '/pages/login/login?role=1' });
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

    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ userInfo });
    this.loadData();
  },

  loadData() {
    app.get('/api/merchant/goods-list').then(res => {
      const goods = res.data || [];
      this.setData({ stats: { pending: goods.length, inProgress: 0, completed: 0 } });
    }).catch(() => {});
    app.get('/api/wallet/info').then(res => {
      this.setData({ wallet: res.data || { balance: 0 } });
    }).catch(() => {});
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/merchant/publish-order/publish-order' });
  },

  goOrders() {
    wx.reLaunch({ url: '/pages/merchant/orders/orders' });
  },

  goWallet() {
    wx.reLaunch({ url: '/pages/merchant/wallet/wallet' });
  },

  goProfile() {
    wx.reLaunch({ url: '/pages/merchant/profile/profile' });
  }
});
