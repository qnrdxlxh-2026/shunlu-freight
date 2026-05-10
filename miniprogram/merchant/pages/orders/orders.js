const app = getApp();

const statusMap = { 1: '待接单', 2: '待取货', 3: '配送中', 4: '已完成', 5: '已取消' };

Page({
  data: {
    orders: [],
    type: 'all',
    tabs: ['全部', '待接单', '待取货', '配送中', '已完成'],
    tabIndex: 0,
    loading: false,
    statusText: statusMap
  },

  onLoad(opts) {
    if (opts.type === 'goods') this.setData({ tabIndex: 0 });
    this.loadOrders();
  },

  onChangeTab(e) {
    // 支持 picker（e.detail.value）和点击 tab（e.currentTarget.dataset.index）
    const index = e.detail !== undefined ? e.detail.value : e.currentTarget.dataset.index;
    this.setData({ tabIndex: index });
    this.loadOrders();
  },

  loadOrders() {
    this.setData({ loading: true });
    app.get('/api/merchant/orders').then(res => {
      const allOrders = res.data || [];
      // 按 tab 筛选
      const statusMap2 = { 0: null, 1: 1, 2: 2, 3: 3, 4: 4 };
      const filterStatus = statusMap2[this.data.tabIndex];
      const orders = filterStatus ? allOrders.filter(o => o.status === filterStatus) : allOrders;
      this.setData({ orders, loading: false });
    }).catch(err => {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish-order/publish-order' });
  }
});
