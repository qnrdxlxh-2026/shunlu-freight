/**
 * utils/amap.js - 高德地图 Web 服务 API 封装
 * 
 * 使用说明：
 * 1. 前往高德开放平台申请 Web 服务 API Key（不是小程序 key）
 *    https://lbs.amap.com/api/webservice/summary/
 * 2. 将下方 AMAP_KEY 替换为申请到的 key
 */

const AMAP_KEY = 'YOUR_AMAP_WEB_SERVICE_KEY'; // TODO: 替换为真实 Key

/**
 * 逆地理编码：坐标 → 地址文字
 * @param {number} lat 纬度
 * @param {number} lng 经度
 */
function reverseGeocode(lat, lng) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://restapi.amap.com/v3/geocode/regeo',
      data: {
        key: AMAP_KEY,
        location: `${lng},${lat}`,
        extensions: 'base',
      },
      success: resolve,
      fail: reject,
    });
  }).then(res => {
    return res.data?.regeocode?.formatted_address || '';
  });
}

/**
 * 地理编码：地址文字 → 坐标
 * @param {string} address 地址
 */
function geocode(address) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://restapi.amap.com/v3/geocode/geocode',
      data: {
        key: AMAP_KEY,
        address,
      },
      success: resolve,
      fail: reject,
    });
  }).then(res => {
    const location = res.data?.geocodes?.[0]?.location;
    if (location) {
      const [lng, lat] = location.split(',');
      return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    return null;
  });
}

/**
 * 驾车路线规划
 * @param {{ lat: number, lng: number }} origin 起点坐标
 * @param {{ lat: number, lng: number }} destination 终点坐标
 */
function getRoute(origin, destination) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://restapi.amap.com/v3/direction/driving',
      data: {
        key: AMAP_KEY,
        origin: `${origin.lng},${origin.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        extensions: 'base',
      },
      success: resolve,
      fail: reject,
    });
  }).then(res => {
    const path = res.data?.route?.paths?.[0];
    return {
      distance: path?.distance || 0, // 米
      duration: path?.duration || 0, // 秒
    };
  });
}

/**
 * 获取当前位置（gcj02 坐标系）
 */
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success: resolve,
      fail: reject,
    });
  });
}

/**
 * 构造司机地图 marker
 * @param {number} lat
 * @param {number} lng
 * @param {string} title
 */
function makeDriverMarker(lat, lng, title = '司机位置') {
  return {
    id: 1,
    latitude: lat,
    longitude: lng,
    width: 32,
    height: 40,
    iconPath: '/assets/icons/driver-marker.png', // TODO: 可替换为自定义司机图标
    title,
  };
}

module.exports = {
  AMAP_KEY,
  reverseGeocode,
  geocode,
  getRoute,
  getCurrentLocation,
  makeDriverMarker,
};
