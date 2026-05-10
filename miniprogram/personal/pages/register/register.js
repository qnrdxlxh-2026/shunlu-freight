const app = getApp();
const api = require('../../utils/api.js');
const { validatePhone } = require('../../utils/util.js');

Page({
  data: {
    phone: '',
    password: '',
    confirmPassword: '',
    loading: false
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onConfirmInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  async onRegister() {
    const { phone, password, confirmPassword } = this.data;
    if (!phone) return wx.showToast({ title: '请输入手机号', icon: 'none' });
    if (!validatePhone(phone)) return wx.showToast({ title: '手机号格式错误', icon: 'none' });
    if (!password || password.length < 6) return wx.showToast({ title: '密码至少6位', icon: 'none' });
    if (password !== confirmPassword) return wx.showToast({ title: '两次密码不一致', icon: 'none' });

    this.setData({ loading: true });
    try {
      const res = await api.register({ phone, password, role: 5 });
      wx.showToast({ title: '注册成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/login/login' });
      }, 1500);
    } catch (e) {
      wx.showToast({ title: e.message || '注册失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goLogin() {
    wx.redirectTo({ url: '/pages/login/login' });
  }
});
