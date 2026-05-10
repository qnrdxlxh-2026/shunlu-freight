// pages/orders/orders.js
const app = getApp();

Page({
  data: {
    currentTab: 'pending',
    orders: [],
    statusText: {
      1: '待接单',
      2: '待取货',
      3: '配送中',
      4: '已完成',
      5: '已取消'
    }
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadOrders();
  },

  async loadOrders() {
    const { currentTab } = this.data;
    let status = '';
    if (currentTab === 'pending') status = '2';
    else if (currentTab === 'delivering') status = '3';
    else if (currentTab === 'completed') status = '4';

    try {
      const res = await app.request({ url: `/orders?status=${status}` });
      if (res.code === 0) {
        this.setData({ orders: res.data.list || res.data || [] });
      }
    } catch (err) {
      console.error('加载订单失败', err);
    }
  },

  viewOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` });
  },

  async confirmPickup(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const res = await app.request({
        url: `/order/${id}/pickup`,
        method: 'POST'
      });
      if (res.code === 0) {
        wx.showToast({ title: '已确认取货', icon: 'success' });
        this.loadOrders();
      } else {
        wx.showToast({ title: res.msg || '操作失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  async confirmDeliver(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认送达',
      content: '确认货物已送达目的地？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await app.request({
              url: `/order/${id}/deliver`,
              method: 'POST'
            });
            if (result.code === 0) {
              wx.showToast({ title: '已确认送达', icon: 'success' });
              this.loadOrders();
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

  onPullDownRefresh() {
    this.loadOrders().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
