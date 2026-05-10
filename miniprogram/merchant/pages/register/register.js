const app = getApp();
const { isValidPhone, showError, showLoading, hideLoading } = require('../../utils/util');

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

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  async handleRegister() {
    const { phone, password, confirmPassword } = this.data;
    
    // 表单验证
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
    
    if (password.length < 6 || password.length > 20) {
      showError('密码长度为6-20位');
      return;
    }
    
    if (!confirmPassword) {
      showError('请确认密码');
      return;
    }
    
    if (password !== confirmPassword) {
      showError('两次输入的密码不一致');
      return;
    }
    
    this.setData({ loading: true });
    showLoading('注册中...');
    
    try {
      const res = await app.post('/api/user/register', {
        phone,
        password,
        role: 1 // 商家角色
      });
      
      hideLoading();
      wx.showToast({ title: '注册成功', icon: 'success', duration: 1500 });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      hideLoading();
      showError(error.message || '注册失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  goLogin() {
    wx.navigateBack();
  }
});