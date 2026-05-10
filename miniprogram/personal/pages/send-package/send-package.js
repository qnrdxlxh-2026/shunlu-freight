const app = getApp();
const api = require('../../utils/api.js');
const { validatePhone } = require('../../utils/util.js');

Page({
  data: {
    senderName: '', senderPhone: '', senderAddress: '', senderLocation: null,
    receiverName: '', receiverPhone: '', receiverAddress: '', receiverLocation: null,
    weight: '', expectedPrice: '', remark: '',
    photos: [],
    mapMarkers: [],
    centerLatitude: 30.5728, centerLongitude: 104.0668,
    loading: false
  },

  onSenderName(e) { this.setData({ senderName: e.detail.value }); },
  onSenderPhone(e) { this.setData({ senderPhone: e.detail.value }); },
  onReceiverName(e) { this.setData({ receiverName: e.detail.value }); },
  onReceiverPhone(e) { this.setData({ receiverPhone: e.detail.value }); },
  onWeight(e) { this.setData({ weight: e.detail.value }); },
  onPrice(e) { this.setData({ expectedPrice: e.detail.value }); },
  onRemark(e) { this.setData({ remark: e.detail.value }); },

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

    this.setData({ loading: true });

    const payload = {
      senderName, senderPhone, senderAddress,
      receiverName, receiverPhone, receiverAddress,
      weight: parseFloat(weight),
      expectedPrice: parseFloat(expectedPrice) * 100,
      remark: this.data.remark,
      senderLocation: this.data.senderLocation,
      receiverLocation: this.data.receiverLocation,
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
    }).then(() => {
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    }).catch(e => {
      wx.showToast({ title: e.message || '发布失败', icon: 'none' });
      this.setData({ loading: false });
    });
  }
});
