const app = getApp();

// 简化版状态：1=待接单, 2=待取货, 3=配送中, 4=已完成, 5=已取消, 6=已签收
const statusMap = { 1: '待接单', 2: '待取货', 3: '配送中', 4: '已完成', 5: '已取消', 6: '已签收' };

Page({
  data: {
    orders: [],
    type: 'all',
    // 简化Tab：只显示新订单、进行中、已完成
    tabs: ['新订单', '进行中', '已完成'],
    tabIndex: 0,
    loading: false,
    statusText: statusMap
  },

  onLoad(opts) {
    if (opts.type === 'goods') this.setData({ tabIndex: 0 });
    this.loadOrders();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadOrders();
  },

  onChangeTab(e) {
    const index = e.detail !== undefined ? e.detail.value : e.currentTarget.dataset.index;
    this.setData({ tabIndex: index });
    this.loadOrders();
  },

  loadOrders() {
    this.setData({ loading: true });
    app.get('/api/merchant/orders').then(res => {
      const allOrders = res.data || [];
      // 简化Tab筛选逻辑
      // tabIndex: 0=新订单(1), 1=进行中(2,3), 2=已完成(4,6)
      const tabStatusMap = {
        0: [1],       // 新订单：待接单
        1: [2, 3],   // 进行中：待取货、配送中
        2: [4, 6]   // 已完成：已完成、已签收
      };
      const filterStatuses = tabStatusMap[this.data.tabIndex] || [];
      const orders = allOrders.filter(o => filterStatuses.includes(o.status));
      this.setData({ orders, loading: false });
    }).catch(err => {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/merchant/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/merchant/publish-order/publish-order' });
  }
});
