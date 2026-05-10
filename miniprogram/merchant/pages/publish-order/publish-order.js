const app = getApp();

Page({
  data: {
    // 地址
    pickup_addr: '',
    pickup_lat: '',
    pickup_lng: '',
    pickup_detail: '',
    delivery_addr: '',
    delivery_lat: '',
    delivery_lng: '',
    delivery_detail: '',
    // 联系人
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    receiver_phone: '',
    // 货物
    weight: '',
    distance: '',
    price: '',
    goods_value: '',
    remark: '',
    // 照片
    photos: [],
    // 运费
    suggestedPrice: 0,
    freightDetails: '',
    // 弹窗
    showFreight: false,
    // 状态
    loading: false,
  },

  // ===== 地图选址 =====
  chooseLocation(e) {
    const type = e.currentTarget.dataset.type;
    wx.chooseLocation({
      success: (res) => {
        if (type === 'pickup') {
          this.setData({
            pickup_addr: res.address || res.name,
            pickup_lat: res.latitude,
            pickup_lng: res.longitude,
          });
        } else {
          this.setData({
            delivery_addr: res.address || res.name,
            delivery_lat: res.latitude,
            delivery_lng: res.longitude,
          });
        }
        // 选址完成后自动估算距离
        this.autoEstimateDistance();
      },
      fail: () => {
        wx.showToast({ title: '请开启位置权限', icon: 'none' });
      }
    });
  },

  // ===== 自动估算距离 =====
  autoEstimateDistance() {
    const { pickup_addr, delivery_addr } = this.data;
    if (!pickup_addr || !delivery_addr) return;
    app.post('/api/price/estimate-distance', {
      start_addr: pickup_addr,
      end_addr: delivery_addr,
    }).then(res => {
      if (res.data && res.data.distance) {
        this.setData({ distance: String(res.data.distance) });
        // 有重量时自动算运费
        if (this.data.weight) this.calculateFreight();
      }
    }).catch(() => {});
  },

  // ===== 输入处理 =====
  onPickupDetailInput(e) { this.setData({ pickup_detail: e.detail.value }); },
  onDeliveryDetailInput(e) { this.setData({ delivery_detail: e.detail.value }); },
  onSenderNameInput(e) { this.setData({ sender_name: e.detail.value }); },
  onSenderPhoneInput(e) { this.setData({ sender_phone: e.detail.value }); },
  onReceiverNameInput(e) { this.setData({ receiver_name: e.detail.value }); },
  onReceiverPhoneInput(e) { this.setData({ receiver_phone: e.detail.value }); },
  onWeightInput(e) {
    this.setData({ weight: e.detail.value });
    if (this.data.distance) this.calculateFreight();
  },
  onDistanceInput(e) {
    this.setData({ distance: e.detail.value });
    if (e.detail.value && this.data.weight) this.calculateFreight();
  },
  onPriceInput(e) { this.setData({ price: e.detail.value }); },
  onValueInput(e) { this.setData({ goods_value: e.detail.value }); },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }); },

  // ===== 自动计算运费 =====
  calculateFreight() {
    const { distance, weight } = this.data;
    if (!distance || !weight) return;
    app.post('/api/price/calculate', {
      distance: parseFloat(distance),
      weight: parseFloat(weight),
      driver_type: 'truck_1ton',
      pickup_zone: this.data.pickup_addr || '',
      delivery_zone: this.data.delivery_addr || '',
    }).then(res => {
      if (res.data) {
        this.setData({
          suggestedPrice: res.data.freight,
          freightDetails: res.data.details || '',
        });
      }
    }).catch(() => {});
  },

  // ===== 使用建议运费 =====
  useSuggestedPrice() {
    if (this.data.suggestedPrice > 0) {
      this.setData({ price: String(this.data.suggestedPrice), showFreight: false });
      wx.showToast({ title: `已设为 ¥${this.data.suggestedPrice}`, icon: 'none' });
    }
  },

  // ===== 运费说明弹窗 =====
  showFreightInfo() {
    const { distance, weight, suggestedPrice } = this.data;
    if (!distance || !weight) {
      wx.showToast({ title: '请先填写距离和重量', icon: 'none' });
      return;
    }
    if (!this.data.freightDetails) {
      this.calculateFreight();
    }
    this.setData({ showFreight: true });
  },
  hideFreightInfo() {
    this.setData({ showFreight: false });
  },

  // ===== 拍照上传 =====
  takePhoto() {
    wx.chooseImage({
      count: Math.min(6 - this.data.photos.length, 9),
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        this.setData({ photos: [...this.data.photos, ...res.tempFilePaths].slice(0, 6) });
      }
    });
  },
  previewPhoto(e) {
    wx.previewImage({ urls: this.data.photos, current: this.data.photos[e.currentTarget.dataset.index] });
  },
  delPhoto(e) {
    const idx = e.currentTarget.dataset.index;
    const photos = [...this.data.photos];
    photos.splice(idx, 1);
    this.setData({ photos });
  },

  // ===== 发布货源 =====
  onPublish() {
    const { pickup_addr, delivery_addr, weight, price, photos } = this.data;
    if (!pickup_addr) return wx.showToast({ title: '请选择取货地址', icon: 'none' });
    if (!delivery_addr) return wx.showToast({ title: '请选择送达地址', icon: 'none' });
    if (!weight) return wx.showToast({ title: '请填写货物重量', icon: 'none' });
    if (!price) return wx.showToast({ title: '请填写期望运费', icon: 'none' });

    this.setData({ loading: true });

    const payload = {
      start_addr: pickup_addr + (this.data.pickup_detail ? ' ' + this.data.pickup_detail : ''),
      end_addr: delivery_addr + (this.data.delivery_detail ? ' ' + this.data.delivery_detail : ''),
      weight: parseFloat(this.data.weight),
      price: parseFloat(this.data.price),
      goods_value: this.data.goods_value ? parseFloat(this.data.goods_value) : 0,
      remark: this.data.remark,
      sender_name: this.data.sender_name,
      sender_phone: this.data.sender_phone,
      receiver_name: this.data.receiver_name,
      receiver_phone: this.data.receiver_phone,
    };

    // 先上传照片
    const uploadPhoto = (paths) => {
      const uploads = paths.map(p =>
        app.uploadFile('/api/upload/photo', p, 'photo').catch(() => ({ data: '' }))
      );
      return Promise.all(uploads).then(results => results.map(r => r.data || ''));
    };

    const photoUpload = photos.length > 0 ? uploadPhoto(photos) : Promise.resolve([]);

    photoUpload.then(photoUrls => {
      payload.photo_urls = photoUrls.filter(Boolean);
      return app.post('/api/merchant/publish-goods', payload);
    }).then(res => {
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    }).catch(err => {
      wx.showToast({ title: err.message || '发布失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },
});
