const app = getApp();
const { formatDateTime, getOrderStatusText, getOrderStatusClass } = require('../../../utils/util.js');

Page({
  data: {
    packages: [],
    loading: true
  },

  onShow() {
    this.loadPackages();
  },

  onPullDownRefresh() {
    this.loadPackages().finally(() => wx.stopPullDownRefresh());
  },

  async loadPackages() {
    this.setData({ loading: true });
    try {
      const res = await app.get('/api/personal/goods-list');
      const packages = (res.data || []).map(p => ({
        ...p,
        statusText: getOrderStatusText(p.status),
        statusClass: getOrderStatusClass(p.status),
        createTime: formatDateTime(p.create_time)
      }));
      this.setData({ packages, loading: false });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/personal/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  }
});
