const app = getApp();
const api = require('../../../utils/api.js');
const { getMatchStars, formatAmount } = require('../../../utils/util.js');

Page({
  data: {
    goods: [],
    loading: true,
    latitude: 30,
    longitude: 102
  },

  onLoad() {
    this.getLocation();
  },

  async getLocation() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.getLocation({ type: 'gcj02', success: resolve, fail: reject });
      });
      this.setData({ latitude: res.latitude, longitude: res.longitude });
    } catch (err) {
      console.log('获取位置失败，使用默认位置');
    }
    this.loadGoods();
  },

  async loadGoods() {
    this.setData({ loading: true });
    try {
      const res = await api.getNearbyGoods({
        latitude: this.data.latitude,
        longitude: this.data.longitude
      });
      const goods = (res.data || []).map(g => ({
        ...g,
        price: formatAmount(g.price || g.expect_price),
        stars: getMatchStars(g.match_score),
        distance: g.distance ? g.distance.toFixed(1) + 'km' : ''
      }));
      this.setData({ goods, loading: false });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async takeOrder(e) {
    const goodsId = e.currentTarget.dataset.id;
    try {
      await api.takeOrder(goodsId);
      wx.showToast({ title: '接单成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/private-car/orders/orders' });
      }, 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '接单失败', icon: 'none' });
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/private-car/find-goods/find-goods?id=' + e.currentTarget.dataset.id });
  }
});
