const app = getApp();

Page({
  data: {
    form: {
      start_addr: '',
      end_addr: '',
      departure_time: '',
      space: '',
      remark: '',
      license_plate: '',
    },
    startLatitude: '',
    startLongitude: '',
    endLatitude: '',
    endLongitude: '',
    vehiclePhotos: [],
    loading: false,
  },

  chooseStart() {
    wx.chooseLocation({
      type: 'gcj02',
      success: res => {
        this.setData({
          'form.start_addr': res.address || res.name,
          startLatitude: res.latitude,
          startLongitude: res.longitude,
        });
      },
      fail: err => {
        wx.showModal({
          title: '无法获取位置',
          content: '请在手机微信中开启位置权限',
          showCancel: false,
        });
      }
    });
  },

  chooseEnd() {
    wx.chooseLocation({
      type: 'gcj02',
      success: res => {
        this.setData({
          'form.end_addr': res.address || res.name,
          endLatitude: res.latitude,
          endLongitude: res.longitude,
        });
      },
      fail: err => {
        wx.showModal({
          title: '无法获取位置',
          content: '请在手机微信中开启位置权限',
          showCancel: false,
        });
      }
    });
  },

  bindTimeChange(e) {
    this.setData({ 'form.departure_time': e.detail.value });
  },

  bindInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['form.' + field]: e.detail.value });
  },

  onLicensePlateInput(e) {
    this.setData({ 'form.license_plate': e.detail.value.toUpperCase() });
  },

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

  async submit() {
    const { form } = this.data;
    if (!form.start_addr) return wx.showToast({ title: '请选择出发地', icon: 'none' });
    if (!form.end_addr) return wx.showToast({ title: '请选择目的地', icon: 'none' });
    if (!form.departure_time) return wx.showToast({ title: '请选择出发时间', icon: 'none' });

    this.setData({ loading: true });

    const payload = {
      start_addr: form.start_addr,
      end_addr: form.end_addr,
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
    if (this.data.vehiclePhotos.length > 0) {
      const uploads = this.data.vehiclePhotos.map(p =>
        app.uploadFile('/api/upload/photo', p, 'photo')
          .then(r => r.data || '')
          .catch(() => '')
      );
      const photoUrls = (await Promise.all(uploads)).filter(Boolean);
      payload.vehicle_photos = photoUrls;
    }

    // 发布行程
    try {
      const res = await app.request({
        url: '/routes',
        method: 'POST',
        data: payload
      });
      if (res.code === 0) {
        wx.showToast({ title: '发布成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        wx.showToast({ title: res.msg || '发布失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '发布失败', icon: 'none' });
    }
    this.setData({ loading: false });
  }
});
