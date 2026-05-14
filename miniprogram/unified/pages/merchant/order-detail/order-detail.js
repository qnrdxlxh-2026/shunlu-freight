const app = getApp();
const api = require('../../../utils/api');

const statusText = {
  0: '待支付',
  1: '待接单',
  2: '待取货',
  3: '配送中',
  4: '已完成',
  5: '已取消',
  6: '已签收',
};

Page({
  data: {
    order: null,
    statusText,
    orderPhotos: [],
    // 评分相关
    hasRated: false,
    comment: '',
    ratedComment: '',
    ratingDimensions: [
      { key: 'timeliness', label: '准时性', score: 0 },
      { key: 'punctuality', label: '守时性', score: 0 },
      { key: 'fulfillment', label: '履约率', score: 0 },
      { key: 'attitude', label: '服务态度', score: 0 },
    ],
  },

  onLoad(opt) {
    if (opt.id) this.loadOrder(opt.id);
  },

  loadOrder(id) {
    app.get('/api/merchant/order/' + id).then(res => {
      if (res.data) {
        const order = res.data;
        // 确保状态有效
        order.status = order.status || 0;
        this.setData({ order });
        // 加载货物照片
        if (order.photo_urls && order.photo_urls.length > 0) {
          this.setData({ orderPhotos: order.photo_urls });
        }
        // 如果没有二维码URL，尝试加载
        if (!order.qr_url) {
          this.loadQRCode(id);
        }
        // 已完成订单，加载评分状态
        if (order.status === 6 && order.driver_id) {
          this.loadRatingStatus(order.driver_id);
        }
      }
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 加载二维码
  loadQRCode(orderId) {
    app.get('/api/orders/' + orderId + '/qrcode').then(res => {
      if (res.data) {
        this.setData({
          'order.qr_url': res.data.qr_url || '',
          'order.delivery_qr_url': res.data.delivery_qr_url || '',
          'order.pickup_code': res.data.pickup_code || res.data.pickup_no || '',
          'order.delivery_code': res.data.delivery_code || res.data.delivery_no || '',
        });
      }
    }).catch(() => {});
  },

  // 加载评分状态
  async loadRatingStatus(driverId) {
    try {
      const res = await api.getDriverRatings(driverId);
      const ratings = res.data || {};
      // 根据当前订单ID判断是否已评价
      const orderId = this.data.order.id || this.data.order.order_id;
      if (ratings[orderId]) {
        const r = ratings[orderId];
        this.setData({ hasRated: true, ratedComment: r.comment || '' });
        // 回填评分星星
        const dims = this.data.ratingDimensions.map(d => ({
          ...d,
          score: r[d.key] || 0,
        }));
        this.setData({ ratingDimensions: dims });
      }
    } catch (e) {}
  },

  // 点击星星评分
  tapRating(e) {
    const key = e.currentTarget.dataset.key;
    const score = parseInt(e.currentTarget.dataset.score);
    const dims = this.data.ratingDimensions.map(d =>
      d.key === key ? { ...d, score } : d
    );
    this.setData({ ratingDimensions: dims });
  },

  // 评论输入
  onCommentInput(e) {
    this.setData({ comment: e.detail.value });
  },

  // 提交评分
  async submitRating() {
    const dims = this.data.ratingDimensions;
    // 检查是否所有维度都已评分
    const unrated = dims.filter(d => d.score === 0);
    if (unrated.length > 0) {
      wx.showToast({ title: '请为所有维度评分', icon: 'none' });
      return;
    }
    const order = this.data.order;
    if (!order.driver_id) {
      wx.showToast({ title: '无法获取司机信息', icon: 'none' });
      return;
    }
    try {
      await api.submitRating({
        order_id: order.id || order.order_id,
        driver_id: order.driver_id,
        timeliness: dims[0].score,
        punctuality: dims[1].score,
        fulfillment: dims[2].score,
        attitude: dims[3].score,
        comment: this.data.comment,
      });
      wx.showToast({ title: '评价成功', icon: 'success' });
      this.setData({ hasRated: true, ratedComment: this.data.comment });
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  // 预览货物照片
  previewOrderPhoto(e) {
    wx.previewImage({
      urls: this.data.orderPhotos,
      current: this.data.orderPhotos[e.currentTarget.dataset.index],
    });
  },

  // 拨打电话
  callDriver() {
    const phone = this.data.order.driver_phone;
    if (phone) wx.makePhoneCall({ phoneNumber: String(phone) });
  },

  // 支付订单
  payOrder() {
    const order = this.data.order;
    wx.showModal({
      title: '确认支付',
      content: `确认支付 ¥${order.price}？`,
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '支付中...' });
        app.post('/api/order/pay', { order_id: order.id }).then(r => {
          wx.hideLoading();
          if (r.data && r.data.code === 0) {
            wx.showToast({ title: '支付成功', icon: 'success' });
            this.loadOrder(order.id);
          } else {
            wx.showToast({ title: r.data && r.data.msg || '支付失败', icon: 'none' });
          }
        }).catch(err => {
          wx.hideLoading();
          wx.showToast({ title: err.message || '支付失败', icon: 'none' });
        });
      }
    });
  },
});