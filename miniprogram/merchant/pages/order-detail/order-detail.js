const app = getApp();

const statusText = {
  0: '待支付',
  1: '待取货',
  2: '配送中',
  3: '已到达',
  4: '已签收',
  5: '已取消',
};

Page({
  data: {
    order: null,
    statusText,
    orderPhotos: [],
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
});
