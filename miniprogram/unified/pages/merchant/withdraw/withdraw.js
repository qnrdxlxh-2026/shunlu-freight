const app = getApp();

Page({
  data: {
    balance: 0,
    amount: '',
    minAmount: 10,
    fee: 0,
    actualAmount: 0,
    loading: false
  },

  onLoad() {
    this.loadBalance();
  },

  onShow() {
    this.loadBalance();
  },

  loadBalance() {
    app.get('/api/wallet/info').then(res => {
      this.setData({ balance: res.data.balance || 0 });
    }).catch(() => {});
  },

  onAmountInput(e) {
    const amount = e.detail.value;
    this.setData({ amount });
    if (amount && !isNaN(amount)) {
      const a = parseFloat(amount);
      const fee = a > 0 ? 1 : 0; // 固定1元手续费
      this.setData({
        fee,
        actualAmount: Math.max(0, a - fee)
      });
    } else {
      this.setData({ fee: 0, actualAmount: 0 });
    }
  },

  // 快捷金额
  setAmount(e) {
    const amt = e.currentTarget.dataset.amt;
    this.setData({ amount: String(amt) });
    this.onAmountInput({ detail: { value: String(amt) } });
  },

  // 全部提现
  withdrawAll() {
    this.setData({ amount: String(Math.floor(this.data.balance)) });
    this.onAmountInput({ detail: { value: String(Math.floor(this.data.balance)) } });
  },

  // 提交提现
  submitWithdraw() {
    const { amount, balance, minAmount } = this.data;
    const a = parseFloat(amount);

    if (!amount || isNaN(a)) {
      wx.showToast({ title: '请输入提现金额', icon: 'none' }); return;
    }
    if (a < minAmount) {
      wx.showToast({ title: '最低提现' + minAmount + '元', icon: 'none' }); return;
    }
    if (a > balance) {
      wx.showToast({ title: '余额不足', icon: 'none' }); return;
    }

    this.setData({ loading: true });
    app.post('/api/wallet/withdraw', { amount: a }).then(res => {
      wx.showToast({ title: '提现申请已提交', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    }).catch(err => {
      wx.showToast({ title: err.message || '提现失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
    });
  }
});
