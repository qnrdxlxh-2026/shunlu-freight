const app = getApp();
const api = require('../../../utils/api.js');

Page({
  data: {
    filterType: 'all',
    drivers: [],
    markers: [],
    mapCenter: { lat: 30.5728, lng: 104.0668 }
  },

  async onShow() {
    await this.loadDrivers();
  },

  async loadDrivers() {
    try {
      const res = await api.getNearbyDrivers();
      const drivers = (res.data.list || []).map(d => ({
        ...d,
        typeText: d.type === 'truck' ? '货车' : '私家车',
        price: (d.price / 100).toFixed(2)
      }));
      const markers = drivers.map((d, i) => ({
        id: d.id, latitude: d.lat, longitude: d.lng,
        iconPath: '/assets/marker-driver.png', width: 30, height: 30,
        callout: { content: d.name, color: '#722ed1', fontSize: 12, borderRadius: 8, padding: 6, bgColor: '#fff', display: 'ALWAYS' }
      }));
      this.setData({ drivers, markers });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  onFilter(e) {
    this.setData({ filterType: e.currentTarget.dataset.type });
  },

  onDriverTap(e) {
    const driver = e.currentTarget.dataset.driver;
    wx.navigateTo({ url: '/pages/personal/chat/chat?userId=' + driver.id + '&name=' + driver.name });
  },

  onChat(e) {
    const id = e.currentTarget.dataset.id;
    const driver = this.data.drivers.find(d => d.id === id);
    wx.navigateTo({ url: '/pages/personal/chat/chat?userId=' + id + '&name=' + (driver ? driver.name : '') });
  },

  onOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认下单',
      content: '确定向该司机发起运输请求？',
      success: async res => {
        if (res.confirm) {
          try {
            // TODO: 个人端向司机下单，需要确认后端接口
            // 后端 /api/driver/take-order 是司机接单接口（需要司机身份）
            // 个人端可能需要用 /api/personal/publish-goods 或创建新的下单接口
            await app.post('/api/driver/take-order', { goods_id: id });
            wx.showToast({ title: '下单成功', icon: 'success' });
            setTimeout(() => wx.reLaunch({ url: '/pages/personal/orders/orders' }), 1500);
          } catch (e2) {
            wx.showToast({ title: e2.message || '下单失败', icon: 'none' });
          }
        }
      }
    });
  }
});
