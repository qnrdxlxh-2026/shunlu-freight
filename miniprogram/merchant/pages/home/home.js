const app = getApp();

Page({
  data: {
    userInfo: null,
    stats: { pending: 0, inProgress: 0, completed: 0 },
    wallet: { balance: 0 }
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ userInfo });
    this.loadData();
  },

  loadData() {
    app.get('/api/merchant/goods-list').then(res => {
      const goods = res.data || [];
      this.setData({ stats: { pending: goods.length, inProgress: 0, completed: 0 } });
    });
    app.get('/api/wallet/info').then(res => {
      this.setData({ wallet: res.data || { balance: 0 } });
    }).catch(() => {});
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish-order/publish-order' });
  },

  goMyGoods() {
    // TabBar 页面用 switchTab
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  goOrders() {
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  goWallet() {
    wx.switchTab({ url: '/pages/wallet/wallet' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});
