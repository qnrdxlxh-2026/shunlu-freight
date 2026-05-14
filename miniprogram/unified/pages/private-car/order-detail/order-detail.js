// pages/order-detail/order-detail.js
const app = getApp();

Page({
  data: {
    orderId: null,
    order: {},
    statusText: {
      1: '待接单',
      2: '待取货',
      3: '配送中',
      4: '已完成',
      5: '已取消',
      6: '已签收',
    }
  },

  onLoad(options) {
    this.setData({ orderId: options.id });
    this.loadOrder();
  },

  async loadOrder() {
    const { orderId } = this.data;
    try {
      const res = await app.get('/api/order/detail/' + orderId);
      if (res.code === 0) {
        this.setData({ order: res.data });
      }
    } catch (err) {
      console.error('加载订单失败', err);
    }
  },

  async confirmPickup() {
    wx.showModal({
      title: '确认取货',
      content: '确认已取到货物？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await app.post('/api/order/pickup', { order_id: this.data.orderId });
            if (result.code === 0) {
              wx.showToast({ title: '已确认取货', icon: 'success' });
              this.loadOrder();
            } else {
              wx.showToast({ title: result.msg || '操作失败', icon: 'none' });
            }
          } catch (err) {
            wx.showToast({ title: '网络错误', icon: 'none' });
          }
        }
      }
    });
  },

  async confirmDeliver() {
    wx.showModal({
      title: '确认送达',
      content: '确认货物已送达目的地？送达后运费将结算到您的钱包。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await app.post('/api/order/deliver', { order_id: this.data.orderId });
            if (result.code === 0) {
              wx.showToast({ title: '已确认送达', icon: 'success' });
              this.loadOrder();
            } else {
              wx.showToast({ title: result.msg || '操作失败', icon: 'none' });
            }
          } catch (err) {
            wx.showToast({ title: '网络错误', icon: 'none' });
          }
        }
      }
    });
  },

  makeCall(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },

  openNavigation() {
    const { order } = this.data;
    // 根据订单状态判断导航目标
    const address = order.status === 2 ? order.pickup_address : order.delivery_address;
    
    wx.chooseLocation({
      success: (res) => {
        wx.openLocation({
          latitude: res.latitude,
          longitude: res.longitude,
          name: address,
          address: address
        });
      },
      fail: () => {
        // 如果用户取消选择，直接用地址搜索
        wx.showToast({ title: '请在地图中搜索地址', icon: 'none' });
      }
    });
  }
});
