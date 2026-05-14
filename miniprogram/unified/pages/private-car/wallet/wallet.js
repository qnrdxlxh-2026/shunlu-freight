// pages/wallet/wallet.js
const app = getApp();

Page({
  data: {
    wallet: {
      balance: 0,
      frozen_amount: 0,
      withdrawable: 0
    },
    transactions: [],
    showWithdraw: false,
    withdrawAmount: ''
  },

  onLoad() {
    this.loadWallet();
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

  async loadWallet() {
    try {
      const res = await app.get('/api/wallet/info');
      if (res.code === 0) {
        this.setData({
          wallet: res.data.wallet || { balance: 0, frozen_amount: 0, withdrawable: 0 },
          transactions: res.data.transactions || []
        });
      }
    } catch (err) {
      console.error('加载钱包失败', err);
    }
  },

  showWithdrawModal() {
    const { withdrawable } = this.data.wallet;
    if (withdrawable <= 0) {
      return wx.showToast({ title: '暂无可提现金额', icon: 'none' });
    }
    this.setData({ showWithdraw: true, withdrawAmount: '' });
  },

  hideWithdrawModal() {
    this.setData({ showWithdraw: false });
  },

  onWithdrawInput(e) {
    this.setData({ withdrawAmount: e.detail.value });
  },

  async doWithdraw() {
    const { withdrawAmount } = this.data;
    const { withdrawable } = this.data.wallet;
    
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      return wx.showToast({ title: '请输入有效金额', icon: 'none' });
    }
    if (amount > withdrawable) {
      return wx.showToast({ title: '超出可提现金额', icon: 'none' });
    }

    try {
      const res = await app.post('/api/wallet/withdraw', { amount });
      
      if (res.code === 0) {
        wx.showToast({ title: '提现申请已提交', icon: 'success' });
        this.hideWithdrawModal();
        this.loadWallet();
      } else {
        wx.showToast({ title: res.msg || '提现失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  onPullDownRefresh() {
    this.loadWallet().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
