// pages/register/register.js
const app = getApp();

Page({
  data: {
    phone: '',
    password: '',
    confirmPassword: '',
    realName: '',
    plateNumber: '',
    carTypes: [
      { value: 'sedan', label: '轿车' },
      { value: 'suv', label: 'SUV' },
      { value: 'mpv', label: 'MPV' },
      { value: 'hatchback', label: '两厢车' }
    ],
    carTypeIndex: -1,
    agreed: false
  },

  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onPasswordInput(e) { this.setData({ password: e.detail.value }); },
  onConfirmPasswordInput(e) { this.setData({ confirmPassword: e.detail.value }); },
  onRealNameInput(e) { this.setData({ realName: e.detail.value }); },
  onPlateNumberInput(e) { this.setData({ plateNumber: e.detail.value }); },
  
  onCarTypeChange(e) {
    this.setData({ carTypeIndex: parseInt(e.detail.value) });
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  goLogin() {
    wx.navigateBack();
  },

  async doRegister() {
    const { phone, password, confirmPassword, realName, plateNumber, carTypeIndex, carTypes, agreed } = this.data;
    
    // 表单验证
    if (!phone || phone.length !== 11) {
      return wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
    }
    if (!password || password.length < 6) {
      return wx.showToast({ title: '密码至少6位', icon: 'none' });
    }
    if (password !== confirmPassword) {
      return wx.showToast({ title: '两次密码不一致', icon: 'none' });
    }
    if (!realName) {
      return wx.showToast({ title: '请输入真实姓名', icon: 'none' });
    }
    if (!plateNumber) {
      return wx.showToast({ title: '请输入车牌号', icon: 'none' });
    }
    if (carTypeIndex < 0) {
      return wx.showToast({ title: '请选择车型', icon: 'none' });
    }
    if (!agreed) {
      return wx.showToast({ title: '请同意服务协议', icon: 'none' });
    }

    wx.showLoading({ title: '注册中...' });

    try {
      const res = await app.request({
        url: '/user/register',
        method: 'POST',
        data: {
          phone,
          password,
          real_name: realName,
          role: 3, // 私家车主
          plate_number: plateNumber,
          car_type: carTypes[carTypeIndex].value
        }
      });

      wx.hideLoading();

      if (res.code === 0) {
        wx.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({ title: res.msg || '注册失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  }
});
