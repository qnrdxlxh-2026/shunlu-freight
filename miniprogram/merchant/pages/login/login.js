const app = getApp();
const { isValidPhone, showError, showLoading, hideLoading } = require('../../utils/util');

Page({
  data: {
    phone: '',
    password: '',
    loading: false
  },

  onLoad() {
    // 检查是否已登录
    if (app.globalData.token) {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async handleLogin() {
    const { phone, password } = this.data;
    
    if (!phone) {
      showError('请输入手机号');
      return;
    }
    
    if (!isValidPhone(phone)) {
      showError('手机号格式不正确');
      return;
    }
    
    if (!password) {
      showError('请输入密码');
      return;
    }
    
    this.setData({ loading: true });
    showLoading('登录中...');
    
    try {
      const res = await app.post('/api/user/login', { phone, password });
      
      // 存储登录信息
      app.globalData.token = res.data.token;
      app.globalData.userInfo = res.data.userInfo;
      wx.setStorageSync('token', res.data.token);
      wx.setStorageSync('userInfo', res.data.userInfo);
      
      hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success', duration: 1500 });
      
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/home' });
      }, 1500);
    } catch (error) {
      hideLoading();
      showError(error.message || '登录失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  }
});