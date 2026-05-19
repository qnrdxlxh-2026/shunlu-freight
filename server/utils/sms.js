/**
 * 腾讯云短信工具
 * 注意：需要配置腾讯云 SecretId 和 SecretKey
 * 获取地址：https://console.cloud.tencent.com/cam/capi
 */

const crypto = require('crypto');

// ==================== 配置项 ====================
// TODO: 替换为你的腾讯云密钥
const TX_SECRET_ID = process.env.TX_SECRET_ID || '';   // SecretId
const TX_SECRET_KEY = process.env.TX_SECRET_KEY || '';  // SecretKey
const TX_SMS_APP_ID = process.env.TX_SMS_APP_ID || '';  // 应用ID
const TX_SMS_APP_KEY = process.env.TX_SMS_APP_KEY || ''; // 应用Key
const TX_SMS_SIGN_NAME = process.env.TX_SMS_SIGN_NAME || '火顺路物流'; // 签名
const TX_SMS_TEMPLATE_ID = process.env.TX_SMS_TEMPLATE_ID || ''; // 模板ID

// ==================== 生成签名 ====================
function generateSign(params, secretKey) {
  const sortedParams = Object.keys(params).sort();
  const signStr = sortedParams.map(key => `${key}=${params[key]}`).join('&');
  return crypto
    .createHmac('sha1', secretKey)
    .update(signStr)
    .digest('base64');
}

// ==================== 发送短信 ====================
/**
 * 发送取件码短信
 * @param {string} phone - 收件人手机号
 * @param {string} pickupCode - 取件码
 * @param {string} orderId - 订单号
 * @returns {Promise<object>} 发送结果
 */
async function sendPickupCodeSMS(phone, pickupCode, orderId) {
  // 检查配置
  if (!TX_SECRET_ID || !TX_SECRET_KEY || !TX_SMS_APP_ID) {
    console.log('[短信] 腾讯云配置未完成，跳过短信发送');
    console.log('[短信] 请配置环境变量 TX_SECRET_ID, TX_SECRET_KEY, TX_SMS_APP_ID');
    // 模拟发送成功
    return { code: 0, msg: '短信配置未完成（模拟发送）', pickupCode, phone };
  }

  const endpoint = 'sms.tencentcloudapi.com';
  const action = 'SendSms';
  const version = '2021-01-11';
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = Math.floor(Math.random() * 1000000);

  const params = {
    SmsSdkAppId: TX_SMS_APP_ID,
    SignName: TX_SMS_SIGN_NAME,
    TemplateId: TX_SMS_TEMPLATE_ID,
    PhoneNumberSet: [`+86${phone}`],
    TemplateParamSet: [pickupCode, orderId]
  };

  const signature = generateSign(params, TX_SECRET_KEY);

  const postData = JSON.stringify({
    Action: action,
    Version: version,
    Timestamp: timestamp,
    Signature: signature,
    Nonce: nonce,
    SecretId: TX_SECRET_ID,
    ...params
  });

  const options = {
    hostname: endpoint,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = require('https').request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch(e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ==================== 模拟发送（开发调试用） ====================
async function sendPickupCodeSMSMock(phone, pickupCode, orderId) {
  console.log(`[短信模拟] 发送到 ${phone}:`);
  console.log(`[短信模拟] 订单号: ${orderId}, 取件码: ${pickupCode}`);
  console.log(`[短信模拟] 内容: 您好！您的货物已发出，取件码为 ${pickupCode}，请凭此码取货。`);
  return { code: 0, msg: '模拟发送成功', phone, pickupCode };
}

module.exports = {
  sendPickupCodeSMS,
  sendPickupCodeSMSMock
};