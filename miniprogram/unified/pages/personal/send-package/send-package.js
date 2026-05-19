const app = getApp();
const api = require('../../../utils/api.js');
const { validatePhone } = require('../../../utils/util.js');

Page({
  data: {
    senderName: '', senderPhone: '', senderAddress: '', senderLocation: null,
    receiverName: '', receiverPhone: '', receiverAddress: '', receiverLocation: null,
    weight: '', expectedPrice: '', remark: '',
    departureDate: '', departureTime: '', today: '',
    photos: [],
    waypoints: [],
    mapMarkers: [],
    centerLatitude: 30.5728, centerLongitude: 104.0668,
    loading: false,
    // 发布成功二维码
    showQRCode: false,
    publishedGoodsId: null,
    qrCodeUrl: ''
  },

  onLoad() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    this.setData({ today: dateStr, departureDate: dateStr });
  },

  onDateChange(e) { this.setData({ departureDate: e.detail.value }); },
  onTimeChange(e) { this.setData({ departureTime: e.detail.value }); },

  onSenderName(e) { this.setData({ senderName: e.detail.value }); },
  onSenderPhone(e) { this.setData({ senderPhone: e.detail.value }); },
  onReceiverName(e) { this.setData({ receiverName: e.detail.value }); },
  onReceiverPhone(e) { this.setData({ receiverPhone: e.detail.value }); },
  onWeight(e) { this.setData({ weight: e.detail.value }); },
  onPrice(e) { this.setData({ expectedPrice: e.detail.value }); },
  onRemark(e) { this.setData({ remark: e.detail.value }); },

  // ===== 中途装卸点 =====
  addWaypoint() {
    const waypoints = [...this.data.waypoints, { address: '', lat: '', lng: '', contact_name: '', contact_phone: '' }];
    this.setData({ waypoints });
  },
  removeWaypoint(e) {
    const idx = e.currentTarget.dataset.index;
    const waypoints = [...this.data.waypoints];
    waypoints.splice(idx, 1);
    this.setData({ waypoints });
  },
  chooseWaypointLocation(e) {
    const idx = e.currentTarget.dataset.index;
    wx.chooseLocation({
      type: 'gcj02',
      success: res => {
        const waypoints = [...this.data.waypoints];
        waypoints[idx] = { ...waypoints[idx], address: res.address || res.name, lat: res.latitude, lng: res.longitude };
        this.setData({ waypoints });
      },
      fail: () => wx.showToast({ title: '请开启位置权限', icon: 'none' })
    });
  },
  onWaypointNameInput(e) {
    const idx = e.currentTarget.dataset.index;
    const waypoints = [...this.data.waypoints];
    waypoints[idx] = { ...waypoints[idx], contact_name: e.detail.value };
    this.setData({ waypoints });
  },
  onWaypointPhoneInput(e) {
    const idx = e.currentTarget.dataset.index;
    const waypoints = [...this.data.waypoints];
    waypoints[idx] = { ...waypoints[idx], contact_phone: e.detail.value };
    this.setData({ waypoints });
  },

  chooseSenderLocation() {
    wx.chooseLocation({
      type: 'gcj02',
      success: res => {
        this.setData({
          senderAddress: res.address || res.name,
          senderLocation: { lat: res.latitude, lng: res.longitude }
        });
        this.updateMap();
      },
      fail: err => {
        wx.showModal({
          title: '无法获取位置',
          content: '请在手机微信中开启位置权限，或在开发者工具中切换到「一般调试」模式使用。',
          showCancel: false,
        });
      }
    });
  },

  chooseReceiverLocation() {
    wx.chooseLocation({
      type: 'gcj02',
      success: res => {
        this.setData({
          receiverAddress: res.address || res.name,
          receiverLocation: { lat: res.latitude, lng: res.longitude }
        });
        this.updateMap();
      },
      fail: err => {
        wx.showModal({
          title: '无法获取位置',
          content: '请在手机微信中开启位置权限，或在开发者工具中切换到「一般调试」模式使用。',
          showCancel: false,
        });
      }
    });
  },

  updateMap() {
    const { senderLocation, receiverLocation } = this.data;
    const markers = [];
    if (senderLocation) {
      markers.push({ id: 1, latitude: senderLocation.lat, longitude: senderLocation.lng, iconPath: '/assets/marker-start.png', width: 30, height: 30 });
    }
    if (receiverLocation) {
      markers.push({ id: 2, latitude: receiverLocation.lat, longitude: receiverLocation.lng, iconPath: '/assets/marker-end.png', width: 30, height: 30 });
    }
    let centerLat = 30.5728, centerLng = 104.0668;
    if (senderLocation && receiverLocation) {
      centerLat = (senderLocation.lat + receiverLocation.lat) / 2;
      centerLng = (senderLocation.lng + receiverLocation.lng) / 2;
    } else if (senderLocation) {
      centerLat = senderLocation.lat;
      centerLng = senderLocation.lng;
    } else if (receiverLocation) {
      centerLat = receiverLocation.lat;
      centerLng = receiverLocation.lng;
    }
    this.setData({ mapMarkers: markers, centerLatitude: centerLat, centerLongitude: centerLng });
  },

  // ===== 物品照片 =====
  takePhoto() {
    const max = 6 - this.data.photos.length;
    if (max <= 0) return wx.showToast({ title: '最多6张', icon: 'none' });
    wx.chooseImage({
      count: max,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: res => {
        this.setData({ photos: [...this.data.photos, ...res.tempFilePaths].slice(0, 6) });
      }
    });
  },

  previewPhoto(e) {
    wx.previewImage({
      urls: this.data.photos,
      current: this.data.photos[e.currentTarget.dataset.index]
    });
  },

  delPhoto(e) {
    const idx = e.currentTarget.dataset.index;
    const photos = [...this.data.photos];
    photos.splice(idx, 1);
    this.setData({ photos });
  },

  async onSubmit() {
    const { senderName, senderPhone, senderAddress, receiverName, receiverPhone, receiverAddress, weight, expectedPrice } = this.data;
    if (!senderName) return wx.showToast({ title: '请输入寄件人姓名', icon: 'none' });
    if (!validatePhone(senderPhone)) return wx.showToast({ title: '寄件人手机号格式错误', icon: 'none' });
    if (!senderAddress) return wx.showToast({ title: '请选择取件地址', icon: 'none' });
    if (!receiverName) return wx.showToast({ title: '请输入收件人姓名', icon: 'none' });
    if (!validatePhone(receiverPhone)) return wx.showToast({ title: '收件人手机号格式错误', icon: 'none' });
    if (!receiverAddress) return wx.showToast({ title: '请选择送达地址', icon: 'none' });
    if (!weight) return wx.showToast({ title: '请输入预计重量', icon: 'none' });
    if (!expectedPrice) return wx.showToast({ title: '请输入期望价格', icon: 'none' });
    if (this.data.photos.length === 0) return wx.showToast({ title: '请上传至少1张货物照片', icon: 'none' });

    this.setData({ loading: true });

    const payload = {
      start_addr: senderAddress,
      end_addr: receiverAddress,
      weight: parseFloat(weight),
      price: parseFloat(expectedPrice),
      goods_value: 0,
      remark: this.data.remark,
      sender_name: senderName,
      sender_phone: senderPhone,
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
      departure_time: this.data.departureDate && this.data.departureTime
        ? `${this.data.departureDate} ${this.data.departureTime}`
        : '',
      waypoints: this.data.waypoints.map((wp, i) => ({
        sort: i + 1,
        address: wp.address || '',
        lat: wp.lat || '',
        lng: wp.lng || '',
        contact_name: wp.contact_name || '',
        contact_phone: wp.contact_phone || '',
      })).filter(wp => wp.address),
    };

    // 上传物品照片
    const uploadPhotos = (paths) => {
      const uploads = paths.map(p =>
        app.uploadFile('/api/upload/photo', p, 'photo')
          .then(r => r.data || '')
          .catch(() => '')
      );
      return Promise.all(uploads).then(results => results.filter(Boolean));
    };

    const photoUpload = this.data.photos.length > 0
      ? uploadPhotos(this.data.photos)
      : Promise.resolve([]);

    photoUpload.then(photoUrls => {
      payload.photo_urls = photoUrls;
      return api.publishGoods(payload);
    }).then(res => {
      // 发布成功，显示二维码
      if (res.data && res.data.goods_id) {
        this.setData({
          loading: false,
          showQRCode: true,
          publishedGoodsId: res.data.goods_id,
          qrCodeUrl: app.globalData.baseUrl + '/api/goods/' + res.data.goods_id + '/qrcode'
        });
      } else {
        wx.showToast({ title: '发布成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    }).catch(e => {
      wx.showToast({ title: e.message || '发布失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  // 关闭二维码弹窗
  closeQRCode() {
    this.setData({ showQRCode: false });
    wx.navigateBack();
  },

  // 保存二维码到相册
  saveQRCode() {
    wx.downloadFile({
      url: this.data.qrCodeUrl,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
        });
      },
      fail: () => wx.showToast({ title: '下载失败', icon: 'none' })
    });
  }
});
