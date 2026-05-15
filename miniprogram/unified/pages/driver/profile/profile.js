const app = getApp();

Page({
  data: {
    userInfo: null,
    orderCount: 0,
    balance: '0.00',
    totalIncome: '0.00',
    avatarUrl: '/assets/default-avatar.png',
    // 驾驶证/车辆信息
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
    tempVehiclePhotos: [],
    menuNames: {
      findGoods: '找货源',
      myRoutes: '我的常跑路线',
      allOrders: '全部订单',
      myWallet: '我的钱包',
      messages: '消息中心',
      editProfile: '编辑资料',
      about: '关于顺路货运',
    },
    sectionTitles: {
      driverService: '🚚 司机服务',
      account: '🔐 账户与工具'
    }
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
    this.loadUserInfo();
    this.loadDriverInfo();
    this.loadAuditStatus();
  },

  async loadUserInfo() {
    try {
      const res = await app.get('/api/user/info');
      this.setData({ userInfo: res.data });
      app.globalData.userInfo = res.data;
    } catch (err) {
      console.log('获取用户信息失败', err);
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

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
  },

  editName() {
    wx.showModal({
      title: '编辑用户名',
      editable: true,
      placeholderText: '请输入用户名',
      success: res => {
        if (res.confirm && res.content) {
          this.setData({ 'userInfo.phone': res.content });
        }
      }
    });
  },

  // ===== 驾驶证/车辆信息 =====
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

  chooseVehiclePhoto() {
    const { tempVehiclePhotos } = this.data;
    if (tempVehiclePhotos.length >= 3) {
      wx.showToast({ title: '最多上传3张', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 3 - tempVehiclePhotos.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
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
        license_no: tempLicenseNo,
        vehicle_plate: tempVehiclePlate,
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

  // ===== 菜单导航 =====
  saveMenuName(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value.trim();
    if (!value) return;
    const menuNames = { ...this.data.menuNames, [key]: value };
    this.setData({ menuNames });
    wx.setStorageSync('driver_menu_names', menuNames);
  },

  editMenuTitle(e) {
    const type = e.currentTarget.dataset.type;
    const placeholders = { 'driver-service': '司机服务', 'account': '账户与工具' };
    wx.showModal({
      title: '编辑分组名称',
      editable: true,
      placeholderText: placeholders[type],
      success: res => {
        if (res.confirm && res.content) {
          const titles = { ...this.data.sectionTitles, [type]: res.content };
          this.setData({ sectionTitles: titles });
          wx.setStorageSync('driver_section_titles', titles);
        }
      }
    });
  },

  goFindGoods() { wx.navigateTo({ url: '/pages/driver/find-goods/find-goods' }); },
  goMyRoutes() { wx.navigateTo({ url: '/pages/driver/my-routes/my-routes' }); },
  goOrders() { wx.reLaunch({ url: '/pages/driver/orders/orders' }); },
  goWallet() { wx.reLaunch({ url: '/pages/driver/wallet/wallet' }); },
  goMessages() { wx.navigateTo({ url: '/pages/driver/messages/messages' }); },

  goEditProfile() {
    wx.showModal({
      title: '编辑资料',
      content: '编辑资料功能即将上线，请耐心等待。',
      confirmText: '好的', showCancel: false
    });
  },

  goUserAgreement() { wx.navigateTo({ url: '/pages/agreement/user-agreement/user-agreement' }); },
  goPrivacyPolicy() { wx.navigateTo({ url: '/pages/agreement/privacy-policy/privacy-policy' }); },
  goAbout() {
    wx.showModal({
      title: '关于顺路货运',
      content: '顺路货运 v1.0.0\n顺航川西藏区供应链旗下货运平台\n致力于为商家、司机、个人用户提供高效便捷的货运撮合服务。',
      confirmText: '我知道了', showCancel: false
    });
  },

  logout() {
    wx.showModal({
      title: '提示', content: '确定退出登录？',
      success: res => {
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
