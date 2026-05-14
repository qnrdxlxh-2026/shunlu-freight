const app = getApp();

Page({
  data: {
    wallet: null,
    records: [],
    showRecharge: false,
    rechargeAmount: '',
    showWithdraw: false,
    withdrawAmount: ''
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
    if (!app.globalData.token && !wx.getStorageSync('token')) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.loadWallet();
  },

  async loadWallet() {
    try {
      const [walletRes, recordsRes] = await Promise.all([
        app.get('/api/wallet/info'),
        app.get('/api/wallet/records')
      ]);
      const wallet = (walletRes && walletRes.data) || {};
      this.setData({
        wallet: {
          ...wallet,
          frozen_amount: wallet.frozen_amount || 0,
          withdrawable: wallet.withdrawable || wallet.balance || 0
        },
        records: (recordsRes && recordsRes.data) || []
      });
    } catch (err) {
      if (err.message === '未登录') {
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      this.setData({ wallet: { balance: 0, frozen_amount: 0, withdrawable: 0 }, records: [] });
    }
  },

  // 充值弹窗
  showRechargeModal() {
    this.setData({ showRecharge: true, rechargeAmount: '' });
  },

  hideRechargeModal() {
    this.setData({ showRecharge: false });
  },

  onRechargeInput(e) {
    this.setData({ rechargeAmount: e.detail.value });
  },

  async doRecharge() {
    const amount = parseFloat(this.data.rechargeAmount);
    if (!amount || amount <= 0) {
      return wx.showToast({ title: '请输入有效金额', icon: 'none' });
    }
    try {
      await app.post('/api/wallet/recharge', { amount });
      wx.showToast({ title: '充值成功', icon: 'success' });
      this.setData({ showRecharge: false });
      this.loadWallet();
    } catch (err) {
      wx.showToast({ title: err.message || '充值失败', icon: 'none' });
    }
  },

  // 提现弹窗
  showWithdrawModal() {
    this.setData({ showWithdraw: true, withdrawAmount: '' });
  },

  hideWithdrawModal() {
    this.setData({ showWithdraw: false });
  },

  onWithdrawInput(e) {
    this.setData({ withdrawAmount: e.detail.value });
  },

  async doWithdraw() {
    const amount = parseFloat(this.data.withdrawAmount);
    if (!amount || amount < 10) {
      return wx.showToast({ title: '最低提现10元', icon: 'none' });
    }
    const withdrawable = this.data.wallet.withdrawable || this.data.wallet.balance || 0;
    if (amount > withdrawable) {
      return wx.showToast({ title: '余额不足', icon: 'none' });
    }
    try {
      await app.post('/api/wallet/withdraw', { amount });
      wx.showToast({ title: '提现申请已提交', icon: 'success' });
      this.setData({ showWithdraw: false });
      this.loadWallet();
    } catch (err) {
      wx.showToast({ title: err.message || '提现失败', icon: 'none' });
    }
  }
});
