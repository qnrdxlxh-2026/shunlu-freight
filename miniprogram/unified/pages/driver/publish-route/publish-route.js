const app = getApp();
const api = require('../../../utils/api.js');
const townshipUtil = require('../../../utils/township');

Page({
  data: {
    form: {
      start_addr: '',
      end_addr: '',
      departure_time: '',
      space: '',
      remark: '',
      license_plate: '',   // 车牌号
    },
    // 乡镇选择
    start_township: '',
    end_township: '',
    township_list: [],
    township_names: [],
    // 经纬度
    startLatitude: '',
    startLongitude: '',
    endLatitude: '',
    endLongitude: '',
    // 车辆照片
    vehiclePhotos: [],
    // 提交状态
    loading: false,
  },

  onLoad() {
    this.setData({
      township_list: townshipUtil.TOWNSHIP_DATA,
      township_names: townshipUtil.TOWNSHIP_DATA.map(t => `${t.county}-${t.name}`)
    });
  },

  // ===== 出发地选址 =====
  chooseStart() {
    wx.chooseLocation({
      type: 'gcj02',
      success: res => {
        this.setData({
          'form.start_addr': res.address || res.name,
          startLatitude: res.latitude,
          startLongitude: res.longitude,
        });
        // 自动识别乡镇
        const township = townshipUtil.identifyTownship(res.address || res.name);
        if (township) {
          this.setData({ start_township: `${township.county}-${township.name}` });
        }
      },
      fail: err => {
        console.error('chooseLocation start fail:', err);
        wx.showModal({
          title: '无法获取位置',
          content: '请在手机微信中开启位置权限，或在开发者工具中切换到「一般调试」模式使用。',
          showCancel: false,
        });
      }
    });
  },

  // ===== 目的地选址 =====
  chooseEnd() {
    wx.chooseLocation({
      type: 'gcj02',
      success: res => {
        this.setData({
          'form.end_addr': res.address || res.name,
          endLatitude: res.latitude,
          endLongitude: res.longitude,
        });
        // 自动识别乡镇
        const township = townshipUtil.identifyTownship(res.address || res.name);
        if (township) {
          this.setData({ end_township: `${township.county}-${township.name}` });
        }
      },
      fail: err => {
        console.error('chooseLocation end fail:', err);
        wx.showModal({
          title: '无法获取位置',
          content: '请在手机微信中开启位置权限，或在开发者工具中切换到「一般调试」模式使用。',
          showCancel: false,
        });
      }
    });
  },

  // ===== 乡镇选择 =====
  onStartTownshipChange(e) {
    const index = e.detail.value;
    this.setData({ start_township: this.data.township_names[index] });
  },
  onEndTownshipChange(e) {
    const index = e.detail.value;
    this.setData({ end_township: this.data.township_names[index] });
  },

  // ===== 出发时间 =====
  bindTimeChange(e) {
    this.setData({ 'form.departure_time': e.detail.value });
  },

  // ===== 输入处理 =====
  bindInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  // ===== 车牌号输入（自动转大写） =====
  onLicensePlateInput(e) {
    this.setData({ 'form.license_plate': e.detail.value.toUpperCase() });
  },

  // ===== 车辆照片上传 =====
  takeVehiclePhoto() {
    const max = 3 - this.data.vehiclePhotos.length;
    if (max <= 0) {
      wx.showToast({ title: '最多3张照片', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: max,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: res => {
        this.setData({
          vehiclePhotos: [...this.data.vehiclePhotos, ...res.tempFilePaths].slice(0, 3)
        });
      }
    });
  },

  previewVehiclePhoto(e) {
    wx.previewImage({
      urls: this.data.vehiclePhotos,
      current: this.data.vehiclePhotos[e.currentTarget.dataset.index]
    });
  },

  delVehiclePhoto(e) {
    const idx = e.currentTarget.dataset.index;
    const photos = [...this.data.vehiclePhotos];
    photos.splice(idx, 1);
    this.setData({ vehiclePhotos: photos });
  },

  // ===== 发布行程 =====
  async submit() {
    const { form } = this.data;
    if (!form.start_addr) return wx.showToast({ title: '请选择出发地', icon: 'none' });
    if (!form.end_addr) return wx.showToast({ title: '请选择目的地', icon: 'none' });
    if (!form.departure_time) return wx.showToast({ title: '请选择出发时间', icon: 'none' });

    // 检查权限
    const hasPerm = await app.hasPermission('route:publish');
    if (!hasPerm) {
      wx.showToast({ title: '权限不足：无法发布路线', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    const payload = {
      start_addr: form.start_addr,
      end_addr: form.end_addr,
      start_township: this.data.start_township,
      end_township: this.data.end_township,
      departure_time: form.departure_time,
      space: parseFloat(form.space) || 0,
      remark: form.remark,
      license_plate: form.license_plate || '',
      start_lat: this.data.startLatitude,
      start_lng: this.data.startLongitude,
      end_lat: this.data.endLatitude,
      end_lng: this.data.endLongitude,
    };

    // 上传车辆照片
    const uploadPhotos = (paths) => {
      const uploads = paths.map(p =>
        app.uploadFile('/api/upload/photo', p, 'photo')
          .then(r => r.data || '')
          .catch(() => '')
      );
      return Promise.all(uploads).then(results => results.filter(Boolean));
    };

    const photoUpload = this.data.vehiclePhotos.length > 0
      ? uploadPhotos(this.data.vehiclePhotos)
      : Promise.resolve([]);

    photoUpload.then(photoUrls => {
      payload.vehicle_photos = photoUrls;
      return api.publishRoute(payload);
    }).then(() => {
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    }).catch(err => {
      wx.showToast({ title: err.message || '发布失败', icon: 'none' });
      this.setData({ loading: false });
    });
  }
});
