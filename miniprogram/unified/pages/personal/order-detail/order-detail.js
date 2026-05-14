const app = getApp();
const { formatDateTime, getOrderStatusText, getOrderStatusClass, formatAmount } = require('../../../utils/util.js');
const api = require('../../../utils/api');

Page({
  data: {
    order: null, orderId: null,
    hasRated: false, comment: '', ratedComment: '',
    ratingDimensions: [
      { key: 'timeliness', label: '准时性', score: 0 },
      { key: 'punctuality', label: '守时性', score: 0 },
      { key: 'fulfillment', label: '履约率', score: 0 },
      { key: 'attitude', label: '服务态度', score: 0 },
    ],
  },

  onLoad(options) {
    this.setData({ orderId: options.id });
    this.loadOrder();
  },

  async loadOrder() {
    try {
      const res = await app.get('/api/order/detail/' + this.data.orderId);
      const order = {
        ...res.data,
        statusText: getOrderStatusText(res.data.status),
        statusClass: getOrderStatusClass(res.data.status),
        amount: formatAmount(res.data.price || res.data.driver_amount),
        createTime: formatDateTime(res.data.create_time),
        pickupTime: formatDateTime(res.data.pickup_time),
        deliverTime: formatDateTime(res.data.deliver_time),
      };
      this.setData({ order });
      // 没有取货码/送达码时主动加载
      if (!order.pickup_code) this.loadCodes();
      // 已完成订单检查评分状态
      if (order.status === 6 && order.driver_id) {
        this.loadRatingStatus(order.driver_id);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  async loadCodes() {
    try {
      const res = await app.get('/api/orders/' + this.data.orderId + '/qrcode');
      if (res.data) {
        this.setData({
          'order.pickup_code': res.data.pickup_code || '',
          'order.delivery_code': res.data.delivery_code || '',
        });
      }
    } catch (e) {}
  },

  async payOrder() {
    try {
      await app.post('/api/order/pay', { order_id: this.data.orderId });
      wx.showToast({ title: '支付成功', icon: 'success' });
      this.loadOrder();
    } catch (err) {
      wx.showToast({ title: err.message || '支付失败', icon: 'none' });
    }
  },

  // 确认签收（支持扫码或填码）
  showConfirmReceipt() {
    const code = this.data.order.delivery_code;
    wx.showModal({
      title: '确认签收',
      content: '司机到达后，请出示送达码或让司机报出手机尾号确认：',
      editable: true,
      placeholderText: '输入送达码',
      success: async res => {
        if (res.confirm) {
          const inputCode = (res.content || '').trim();
          if (!inputCode) {
            wx.showToast({ title: '请输入送达码', icon: 'none' });
            return;
          }
          if (inputCode !== code) {
            wx.showToast({ title: '送达码错误', icon: 'none' });
            return;
          }
          try {
            await app.post('/api/orders/' + this.data.orderId + '/verify', { code: inputCode, action: 'delivery' });
            wx.showToast({ title: '签收成功', icon: 'success' });
            this.loadOrder();
          } catch (err) {
            wx.showToast({ title: err.message || '签收失败', icon: 'none' });
          }
        }
      }
    });
  },

  callDriver() {
    if (this.data.order && this.data.order.driver_phone) {
      wx.makePhoneCall({ phoneNumber: String(this.data.order.driver_phone) });
    }
  },

  goChat() {
    if (this.data.order && this.data.order.driver_id) {
      wx.navigateTo({
        url: `/pages/chat/chat?toId=${this.data.order.driver_id}&orderId=${this.data.orderId}`
      });
    }
  },

  async loadRatingStatus(driverId) {
    try {
      const res = await api.getDriverRatings(driverId);
      const ratings = res.data;
      const orderId = this.data.orderId;
      const myRating = (ratings && ratings.ratings) ? ratings.ratings.find(r => r.order_id == orderId) : null;
      if (myRating) {
        this.setData({ hasRated: true, ratedComment: myRating.comment || '' });
        const dims = this.data.ratingDimensions.map(d => ({ ...d, score: myRating[d.key] || 0 }));
        this.setData({ ratingDimensions: dims });
      }
    } catch (e) {}
  },

  tapRating(e) {
    const key = e.currentTarget.dataset.key;
    const score = parseInt(e.currentTarget.dataset.score);
    const dims = this.data.ratingDimensions.map(d => d.key === key ? { ...d, score } : d);
    this.setData({ ratingDimensions: dims });
  },

  onCommentInput(e) { this.setData({ comment: e.detail.value }); },

  async submitRating() {
    const dims = this.data.ratingDimensions;
    if (dims.every(d => d.score === 0)) return wx.showToast({ title: '请至少评一个维度', icon: 'none' });
    const order = this.data.order;
    if (!order.driver_id) return wx.showToast({ title: '无法获取司机信息', icon: 'none' });
    try {
      await api.submitRating({
        order_id: parseInt(this.data.orderId), driver_id: order.driver_id,
        timeliness: dims[0].score, punctuality: dims[1].score,
        fulfillment: dims[2].score, attitude: dims[3].score,
        comment: this.data.comment,
      });
      wx.showToast({ title: '评价成功', icon: 'success' });
      this.setData({ hasRated: true, ratedComment: this.data.comment });
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  }
});