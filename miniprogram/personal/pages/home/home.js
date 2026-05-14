const app = getApp();
const api = require('../../utils/api.js');
const { getOrderStatusText, formatDate } = require('../../utils/util.js');

Page({
  data: {
    userInfo: {},
    stats: { pending: 0, transit: 0, done: 0 },
    latestOrders: []
  },

  async onShow() {
    console.log('home onShow, globalData.token=', app.globalData.token ? '有' : '无', 'storage.token=', wx.getStorageSync('token') ? '有' : '无');
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    console.log('userInfo=', JSON.stringify(userInfo));
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

  goSendPackage() { wx.navigateTo({ url: '/pages/send-package/send-package' }); },
  goFindDrivers() { wx.navigateTo({ url: '/pages/find-drivers/find-drivers' }); },
  goMyPackages() { wx.navigateTo({ url: '/pages/my-packages/my-packages' }); },
  goWallet() { wx.switchTab({ url: '/pages/wallet/wallet' }); },
  goOrders(e) {
    // orders 是 TabBar 页面，必须用 switchTab，不能传参数
    wx.switchTab({ url: '/pages/orders/orders' });
  },
  goOrderDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  }
});
