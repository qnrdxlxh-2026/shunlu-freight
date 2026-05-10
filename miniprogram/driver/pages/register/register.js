const api = require('../../utils/api.js');
const { validatePhone, validatePassword } = require('../../utils/util.js');

Page({
  data: {
    phone: '',
    password: '',
    confirmPassword: '',
    driverType: 2, // 默认货车司机
    loading: false
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  onSelectType(e) {
    const type = parseInt(e.currentTarget.dataset.type);
    this.setData({ driverType: type });
  },

  async onRegister() {
    const { phone, password, confirmPassword, driverType } = this.data;

    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (!validatePhone(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    if (!validatePassword(password)) {
      wx.showToast({ title: '密码至少6位', icon: 'none' });
      return;
    }
    if (password !== confirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await api.register({
        phone,
        password,
        role: driverType
      });
      // 注册成功，自动登录
      const { token, userInfo } = res.data;
      wx.setStorageSync('token', token);
      wx.setStorageSync('userInfo', userInfo);
      wx.showToast({ title: '注册成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/home' });
      }, 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '注册失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goLogin() {
    wx.navigateBack();
  }
});
