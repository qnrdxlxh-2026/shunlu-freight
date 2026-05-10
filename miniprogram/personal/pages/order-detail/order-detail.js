const app = getApp();
const { formatDateTime, getOrderStatusText, getOrderStatusClass, formatAmount } = require('../../utils/util.js');

Page({
  data: { order: null, orderId: null },

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
  }
});