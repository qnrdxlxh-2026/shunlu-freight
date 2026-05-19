/**
 * utils/gpsReporter.js - 司机端 GPS 实时位置上报
 * 
 * 登录成功后启动，页面销毁时停止。
 * 每 30 秒自动上报一次当前 GPS 坐标到后端。
 */

const api = require('./api.js');

let reportTimer = null;
const REPORT_INTERVAL = 30000; // 30 秒

/**
 * 启动 GPS 上报（幂等，多次调用无副作用）
 */
function startGPSReport() {
  if (reportTimer) return; // 已在运行

  reportTimer = setInterval(async () => {
    try {
      const loc = await new Promise((resolve, reject) => {
        wx.getLocation({ type: 'gcj02', success: resolve, fail: reject });
      });
      await api.reportDriverLocation(loc.latitude, loc.longitude);
      console.log('[GPS] 位置已上报', loc.latitude, loc.longitude);
    } catch (err) {
      console.log('[GPS] 上报失败', err.message || err);
    }
  }, REPORT_INTERVAL);

  // 启动时立即上报一次
  _reportOnce();
}

/** 立即上报一次（静默失败） */
async function _reportOnce() {
  try {
    const loc = await new Promise((resolve, reject) => {
      wx.getLocation({ type: 'gcj02', success: resolve, fail: reject });
    });
    await api.reportDriverLocation(loc.latitude, loc.longitude);
    console.log('[GPS] 启动上报', loc.latitude, loc.longitude);
  } catch (err) {
    console.log('[GPS] 启动上报失败', err.message || err);
  }
}

/**
 * 停止 GPS 上报
 */
function stopGPSReport() {
  if (reportTimer) {
    clearInterval(reportTimer);
    reportTimer = null;
    console.log('[GPS] 已停止');
  }
}

module.exports = {
  startGPSReport,
  stopGPSReport,
};
