const app = getApp();
const { formatDateTime, getOrderStatusText, getOrderStatusClass, formatAmount } = require('../../../utils/util.js');

Page({
  data: { order: null, orderId: null, deliveryCode: '' },

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
        signTime: formatDateTime(res.data.sign_time),
        // 发货方手机号（商家或个人的手机）
        sender_phone: res.data.merchant_phone || res.data.sender_phone || '',
        // 收货方手机号
        receiver_phone: res.data.receiver_phone || res.data.personal_phone || '',
      };
      this.setData({ order });

      // 如果没有取货码/送达码，主动加载
      if (!order.pickup_code) {
        this.loadCodes();
      }
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  // 加载取货码和送达码
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

  // 确认取货
  async confirmPickup() {
    const code = this.data.order.pickup_code;
    wx.showModal({
      title: '确认取货',
      content: '请确认已从发货方取到货物，输入取货码：' + code,
      editable: true,
      placeholderText: '输入取货码',
      success: async res => {
        if (res.confirm && res.content === code) {
          try {
            await app.post('/api/order/pickup', { order_id: this.data.orderId });
            wx.showToast({ title: '取货成功', icon: 'success' });
            this.loadOrder();
          } catch (err) {
            wx.showToast({ title: err.message || '取货失败', icon: 'none' });
          }
        } else if (res.confirm && res.content && res.content !== code) {
          wx.showToast({ title: '取货码错误', icon: 'none' });
        }
      }
    });
  },

  // 导航去取货点
  navigateToStart() {
    const order = this.data.order;
    if (!order.start_lat || !order.start_lng) {
      wx.showToast({ title: '取货点无坐标', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: order.start_lat,
      longitude: order.start_lng,
      name: order.start_addr,
      address: order.start_addr,
      scale: 16
    });
  },

  // 导航去目的地
  navigateToEnd() {
    const order = this.data.order;
    if (!order.end_lat || !order.end_lng) {
      wx.showToast({ title: '目的地无坐标', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: order.end_lat,
      longitude: order.end_lng,
      name: order.end_addr,
      address: order.end_addr,
      scale: 16
    });
  },

  // 取件码输入
  onDeliveryCodeInput(e) {
    this.setData({ deliveryCode: e.detail.value });
  },

  // 确认送达（有取件码）
  async confirmDelivery() {
    const order = this.data.order;
    const inputCode = this.data.deliveryCode;
    if (!inputCode || inputCode.length !== 6) {
      wx.showToast({ title: '请输入6位取件码', icon: 'none' });
      return;
    }
    // 验证取件码
    try {
      wx.showLoading({ title: '验证中...' });
      const res = await app.post(`/api/orders/${this.data.orderId}/verify`, { code: inputCode, action: 'delivery' });
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ title: '送达成功', icon: 'success' });
        this.setData({ deliveryCode: '' });
        this.loadOrder();
      } else {
        wx.showToast({ title: res.msg || '取件码错误', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // 确认送达（支持扫码或填码）
  showDeliveryVerify() {
    const code = this.data.order.delivery_code;
    wx.showModal({
      title: '确认送达',
      content: '请让收货方出示送达码，输入送达码确认：',
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
            wx.showToast({ title: '已确认送达', icon: 'success' });
            this.loadOrder();
          } catch (err) {
            wx.showToast({ title: err.message || '送达确认失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 虚拟电话联系发货方
  async virtualCall() {
    try {
      const res = await app.post('/api/message/call-request', {
        order_id: this.data.orderId,
        target_id: this.data.order.sender_phone
      });
      if (res.data && res.data.virtual_no) {
        wx.showModal({
          title: '📞 虚拟号码已生成',
          content: '请用此号码拨打发货方（5分钟内有效）：\n\n' + res.data.virtual_no + '\n\n对方看到的来电显示为此号码',
          confirmText: '呼叫',
          success: r => {
            if (r.confirm) wx.makePhoneCall({ phoneNumber: res.data.virtual_no });
          }
        });
      }
    } catch (err) {
      // fallback：直接拨打电话
      this.callSender();
    }
  },

  // 直接拨打发货方
  callSender() {
    const phone = this.data.order.sender_phone;
    if (phone) wx.makePhoneCall({ phoneNumber: String(phone) });
  },

  // 直接拨打收货方
  callReceiver() {
    const phone = this.data.order.receiver_phone;
    if (phone) wx.makePhoneCall({ phoneNumber: String(phone) });
  },

  // ===== Phase 4: GPS定位功能 =====
  async reportLocation() {
    wx.showLoading({ title: '获取位置...' });
    wx.getLocation({
      type: 'gcj02',
      success: async (res) => {
        wx.hideLoading();
        try {
          const result = await app.post('/api/driver/location', {
            order_id: this.data.orderId,
            lat: res.latitude,
            lng: res.longitude,
            address: '',
            speed: res.speed || 0,
            heading: res.heading || 0,
            accuracy: res.accuracy || 0
          });
          if (result.code === 0) {
            wx.showToast({ title: '位置已上报', icon: 'success' });
          } else {
            wx.showToast({ title: result.msg || '上报失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '网络错误', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '获取位置失败', icon: 'none' });
      }
    });
  },

  async viewDriverTrack() {
    try {
      const res = await app.get('/api/driver/track?order_id=' + this.data.orderId);
      if (res.code === 0 && res.data && res.data.length > 0) {
        const track = res.data[0];
        wx.openLocation({
          latitude: track.lat,
          longitude: track.lng,
          name: '司机位置',
          address: track.address || '',
          scale: 15
        });
      } else {
        wx.showToast({ title: '暂无位置信息', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '查询失败', icon: 'none' });
    }
  },

  // ===== Waypoint取件码验证 =====
  // 输入waypoint取件码
  onWaypointCodeInput(e) {
    const index = e.currentTarget.dataset.index;
    const code = e.detail.value;
    this.setData({
      [`order.waypoints[${index}].verifyCode`]: code
    });
  },

  // 验证waypoint取件码
  async verifyWaypointCode(e) {
    const index = e.currentTarget.dataset.index;
    const goodsId = e.currentTarget.dataset.goodsId;
    const waypoint = this.data.order.waypoints[index];
    const code = waypoint.verifyCode;
    
    if (!code) {
      wx.showToast({ title: '请输入取件码', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '验证中...' });
    try {
      const res = await app.post(`/api/goods/${goodsId}/waypoint/${index}/verify`, { code });
      wx.hideLoading();
      
      if (res.code === 0) {
        wx.showToast({ title: '验证成功', icon: 'success' });
        // 标记该waypoint为已验证
        this.setData({
          [`order.waypoints[${index}].verified`]: true,
          [`order.waypoints[${index}].verifyCode`]: ''
        });
      } else {
        wx.showToast({ title: res.msg || '验证失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  }
});