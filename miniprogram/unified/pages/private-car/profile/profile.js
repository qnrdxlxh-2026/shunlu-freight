const app = getApp();

Page({
  data: {
    userInfo: {},
    todayOrders: 0,
    avatarUrl: '/assets/default-avatar.png',
    driverInfo: {
      license_no: '',
      vehicle_plate: '',
      vehicle_photos: [],
      driver_info_completed: false
    },
    showDriverModal: false,
    auditStatus: 'none',
    rejectReason: '',
    tempLicenseNo: '',
    tempVehiclePlate: '',
    tempLicenseFront: '',
    tempLicenseBack: '',
    tempVehicleFront: '',
    tempVehicleBack: '',
    tempVehiclePhotos: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().init();
      const pages = getCurrentPages();
      const currentPath = "/" + pages[pages.length - 1].route;
      const list = this.getTabBar().data.list;
      const idx = list.findIndex(item => item.pagePath === currentPath);
      this.getTabBar().setData({ selected: idx >= 0 ? idx : 0 });
    }
    this.loadData();
    this.loadDriverInfo();
    this.loadAuditStatus();
  },

  async loadData() {
    try {
      const res = await app.get('/api/user/info');
      this.setData({ userInfo: res.data });
      app.globalData.userInfo = res.data;
    } catch (err) {
      console.error('加载数据失败', err);
    }
  },

  async loadDriverInfo() {
    try {
      const res = await app.get('/api/user/driver-info');
      if (res.code === 0 && res.data) {
        this.setData({ driverInfo: res.data });
      }
    } catch (err) {
      console.log('获取司机信息失败', err);
    }
  },

  async loadAuditStatus() {
    try {
      const res = await app.get('/api/driver/audit-status');
      if (res.code === 0 && res.data) {
        this.setData({ auditStatus: res.data.status || 'none', rejectReason: res.data.reject_reason || '' });
      }
    } catch (e) { console.log('审核状态获取失败'); }
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success: (res) => {
        if (res.tempFiles.length > 0) {
          this.setData({ avatarUrl: res.tempFiles[0].tempFilePath });
          wx.showToast({ title: '头像已更新', icon: 'success' });
        }
      }
    });
  },

  // ===== 证件信息弹窗 =====
  openDriverModal() {
    const { driverInfo } = this.data;
    this.setData({
      showDriverModal: true,
      tempLicenseNo: driverInfo.license_no || '',
      tempVehiclePlate: driverInfo.vehicle_plate || '',
      tempLicenseFront: driverInfo.license_front || '',
      tempLicenseBack: driverInfo.license_back || '',
      tempVehicleFront: driverInfo.vehicle_front || '',
      tempVehicleBack: driverInfo.vehicle_back || '',
      tempVehiclePhotos: [...(driverInfo.vehicle_photos || [])]
    });
  },

  closeDriverModal() {
    this.setData({ showDriverModal: false });
  },

  onModalInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  choosePhoto(e) {
    const field = e.currentTarget.dataset.field;
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success: (res) => { this.setData({ [field]: res.tempFiles[0].tempFilePath }); }
    });
  },

  removePhoto(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: '' });
  },

  chooseVehiclePhoto() {
    const { tempVehiclePhotos } = this.data;
    if (tempVehiclePhotos.length >= 3) {
      wx.showToast({ title: '最多上传3张', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 3 - tempVehiclePhotos.length,
      mediaType: ['image'], sourceType: ['album', 'camera'],
      success: (res) => {
        const newPhotos = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ tempVehiclePhotos: [...tempVehiclePhotos, ...newPhotos] });
      }
    });
  },

  delVehiclePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = [...this.data.tempVehiclePhotos];
    photos.splice(index, 1);
    this.setData({ tempVehiclePhotos: photos });
  },

  async submitAudit() {
    const { tempLicenseFront, tempLicenseBack, tempVehicleFront, tempVehicleBack, tempVehiclePhotos } = this.data;
    if (!tempLicenseFront) return wx.showToast({ title: '请上传驾驶证正面', icon: 'none' });
    if (!tempLicenseBack) return wx.showToast({ title: '请上传驾驶证反面', icon: 'none' });
    if (!tempVehicleFront) return wx.showToast({ title: '请上传行驶证正面', icon: 'none' });
    if (!tempVehicleBack) return wx.showToast({ title: '请上传行驶证反面', icon: 'none' });
    wx.showLoading({ title: '提交中...' });
    try {
      const res = await app.post('/api/driver/audit-submit', {
        license_front: tempLicenseFront, license_back: tempLicenseBack,
        vehicle_front: tempVehicleFront, vehicle_back: tempVehicleBack,
        vehicle_photos: tempVehiclePhotos || []
      });
      wx.hideLoading();
      if (res.code === 0) {
        wx.showToast({ title: '已提交审核', icon: 'success' });
        this.setData({ showDriverModal: false, auditStatus: 'pending' });
      } else { wx.showToast({ title: res.msg || '提交失败', icon: 'none' }); }
    } catch (e) { wx.hideLoading(); wx.showToast({ title: '网络错误', icon: 'none' }); }
  },

  async saveDriverInfo() {
    const { tempLicenseNo, tempVehiclePlate, tempVehiclePhotos } = this.data;
    if (!tempLicenseNo) return wx.showToast({ title: '请输入驾驶证号', icon: 'none' });
    if (!tempVehiclePlate) return wx.showToast({ title: '请输入车牌号', icon: 'none' });
    try {
      await app.post('/api/user/update-driver-info', {
        license_no: tempLicenseNo, vehicle_plate: tempVehiclePlate,
        vehicle_photos: tempVehiclePhotos
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({
        showDriverModal: false,
        'driverInfo.license_no': tempLicenseNo,
        'driverInfo.vehicle_plate': tempVehiclePlate,
        'driverInfo.vehicle_photos': tempVehiclePhotos,
        'driverInfo.driver_info_completed': true
      });
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    }
  },

  goOrders() { wx.reLaunch({ url: '/pages/private-car/orders/orders' }); },
  goWallet() { wx.reLaunch({ url: '/pages/private-car/wallet/wallet' }); },

  goUserAgreement() { wx.navigateTo({ url: '/pages/agreement/user-agreement/user-agreement' }); },
  goPrivacyPolicy() { wx.navigateTo({ url: '/pages/agreement/privacy-policy/privacy-policy' }); },
  showRules() {
    wx.showModal({
      title: '私家车主接单规则',
      content: '1. 单票限重≤20kg\n2. 货值限额≤2000元\n3. 每日限接2单\n4. 县城内运费10元/单\n5. 平台抽成10%',
      showCancel: false, confirmText: '我知道了'
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录', content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          app.globalData.token = null;
          app.globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});
