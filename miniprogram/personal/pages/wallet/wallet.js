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
    this.loadWallet();
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
          frozen_amount: wallet.frozen_amount || 0,
          withdrawable: wallet.withdrawable || wallet.balance || 0
        },
        records: recordsRes.data || []
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
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
