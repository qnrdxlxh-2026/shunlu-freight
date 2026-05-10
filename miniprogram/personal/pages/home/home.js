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
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    this.setData({ userInfo });
    await this.loadData();
  },

  async loadData() {
    try {
      const [userRes, ordersRes] = await Promise.all([
        api.getUserInfo().catch(() => ({ data: {} })),
        api.getPersonalOrders().catch(() => ({ data: { list: [] } }))
      ]);

      const orders = ordersRes.data.list || [];
      const statusCount = (arr, status) => arr.filter(o => o.status === status).length;

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
