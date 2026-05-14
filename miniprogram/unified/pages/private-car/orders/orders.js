// pages/orders/orders.js
const app = getApp();

Page({
  data: {
    currentTab: 'pending',
    orders: [],
    statusText: {
      1: '待接单',
      2: '已接单',
      3: '已取货',
      4: '运输中',
      5: '已送达',
      6: '已完成',
      7: '已取消'
    }
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {

    // 初始化自定义TabBar
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().init();
      const pages = getCurrentPages();
      const currentPath = "/" + pages[pages.length - 1].route;
      const list = this.getTabBar().data.list;
      const idx = list.findIndex(item => item.pagePath === currentPath);
      this.getTabBar().setData({ selected: idx >= 0 ? idx : 0 });
    }
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
    if (currentTab === 'pending') status = '1,2';
    else if (currentTab === 'delivering') status = '3,4,5';
    else if (currentTab === 'completed') status = '6';
    else if (currentTab === 'cancelled') status = '7';

    try {
      const res = await app.get('/api/driver/orders', { status });
      // 后端返回数组，兼容 { list } 格式
      const list = Array.isArray(res.data) ? res.data : (res.data.list || res.data || []);
      if (status) {
        // 支持多状态过滤（如 '1,2'）
        const statusArr = status.split(',').map(s => parseInt(s));
        const filtered = list.filter(o => statusArr.includes(o.status));
        this.setData({ orders: filtered });
      } else {
        this.setData({ orders: list });
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
      const res = await app.post('/api/order/pickup', { order_id: id });
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
            const result = await app.post('/api/order/deliver', { order_id: id });
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
