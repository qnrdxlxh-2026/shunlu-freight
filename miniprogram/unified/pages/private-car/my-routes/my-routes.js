const app = getApp();
const { formatDateTime } = require('../../../utils/util.js');

Page({
  data: { routes: [], loading: true },
  onShow() { this.loadRoutes(); },
  onPullDownRefresh() { this.loadRoutes().finally(() => wx.stopPullDownRefresh()); },
  async loadRoutes() {
    this.setData({ loading: true });
    try {
      const res = await app.get('/api/driver/my-routes');
      const routes = (res.data || []).map(r => ({ ...r, createTime: formatDateTime(r.create_time) }));
      this.setData({ routes, loading: false });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },
  goPublish() { wx.navigateTo({ url: '/pages/private-car/publish-route/publish-route' }); }
});
