// pages/login/login.js
const app = getApp();

Page({
  data: {
    phone: '',
    password: ''
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async doLogin() {
    const { phone, password } = this.data;
    
    if (!phone || phone.length !== 11) {
      return wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
    }
    if (!password) {
      return wx.showToast({ title: '请输入密码', icon: 'none' });
    }

    wx.showLoading({ title: '登录中...' });
    
    try {
      const res = await app.login(phone, password);
      wx.hideLoading();
      
      // 检查角色是否为私家车主
      if (res.userInfo.role !== 3) {
        wx.showToast({ title: '此账号不是私家车主', icon: 'none' });
        app.logout();
        return;
      }
      
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/home' });
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err || '登录失败', icon: 'none' });
    }
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  }
});
