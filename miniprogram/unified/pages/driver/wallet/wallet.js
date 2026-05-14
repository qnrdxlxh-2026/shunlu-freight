const app = getApp();
const { formatAmount, formatDateTime } = require('../../../utils/util.js');

Page({
  data: {
    wallet: null,
    records: [],
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
    this.loadWallet();
  },

  onPullDownRefresh() {
    this.loadWallet().finally(() => wx.stopPullDownRefresh());
  },

  async loadWallet() {
    try {
      const [walletRes, recordsRes] = await Promise.all([
        app.get('/api/wallet/info').catch(() => ({ data: { balance: 0 } })),
        app.get('/api/wallet/records').catch(() => ({ data: [] }))
      ]);
      const wallet = walletRes.data || {};
      this.setData({
        wallet: {
          ...wallet,
          total_income: wallet.total_income || 0,
          pending_settlement: wallet.pending_settlement || 0,
          frozen_amount: wallet.frozen_amount || 0,
          withdrawable: wallet.withdrawable || wallet.balance || 0
        },
        records: (recordsRes.data || []).map(r => ({
          ...r,
          amountText: formatAmount ? formatAmount(Math.abs(r.amount)) : Math.abs(r.amount).toFixed(2),
          timeText: formatDateTime ? formatDateTime(r.create_time) : (r.create_time || '')
        }))
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  // 提现弹窗（司机只赚运费，无需充值功能）
  showWithdrawModal() {
    this.setData({ showWithdraw: true, withdrawAmount: '' });
  },

  hideWithdrawModal() {
    this.setData({ showWithdraw: false });
  },

  onWithdrawAmountInput(e) {
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
