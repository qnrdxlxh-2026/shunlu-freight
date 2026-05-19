const app = getApp();

Page({
  data: {
    goodsId: ''
  },

  // 扫码接单
  startScan() {
    wx.scanCode({
      success: res => {
        this.handleScanResult(res.result);
      },
      fail: err => {
        wx.showToast({ title: '扫码失败', icon: 'none' });
      }
    });
  },

  // 处理扫码结果
  handleScanResult(result) {
    try {
      // 解析二维码内容（JSON格式：{type:'goods', id:xxx}）
      const data = JSON.parse(result);
      if (data.type === 'goods' && data.id) {
        this.takeOrder(data.id);
      } else {
        // 直接当作ID处理
        this.takeOrder(parseInt(result));
      }
    } catch(e) {
      // 直接当作ID处理
      this.takeOrder(parseInt(result));
    }
  },

  // 输入货源编号
  onInputGoodsId(e) {
    this.setData({ goodsId: e.detail.value });
  },

  // 手动接单
  manualTake() {
    const goodsId = this.data.goodsId;
    if (!goodsId) {
      wx.showToast({ title: '请输入货源编号', icon: 'none' });
      return;
    }
    this.takeOrder(parseInt(goodsId));
  },

  // 执行接单（私家车 role=3）
  async takeOrder(goodsId) {
    try {
      wx.showLoading({ title: '接单中...' });
      const res = await app.post('/api/driver/take-order', { goods_id: goodsId });
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ title: '接单成功', icon: 'success' });
        // 跳转到订单详情
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/private-car/order-detail/order-detail?id=${res.data.order_id}`
          });
        }, 1500);
      } else {
        wx.showToast({ title: res.msg || '接单失败', icon: 'none' });
      }
    } catch(err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  }
});