// 快速测试后端API
const http = require('http');

function testAPI(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3458,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 开始内部API测试...\n');
  
  // 先登录获取token
  console.log('1. 登录获取token...');
  let token = null;
  try {
    const loginRes = await testAPI('/api/user/login', 'POST', {
      phone: '13900000002',
      password: '123456',
      role: 2
    });
    console.log('  登录状态:', loginRes.status);
    if (loginRes.data && loginRes.data.data && loginRes.data.data.token) {
      token = loginRes.data.data.token;
      console.log('  ✅ Token获取成功');
    } else {
      console.log('  ❌ 登录失败:', JSON.stringify(loginRes.data));
      return;
    }
  } catch (e) {
    console.log('  ❌ 登录错误:', e.message);
    return;
  }
  
  // 测试2: 获取佣金信息（需要认证）
  console.log('\n2. 测试 GET /api/commission/info');
  try {
    const res2 = await testAPI('/api/commission/info', 'GET', null, token);
    console.log('  状态:', res2.status);
    console.log('  响应:', JSON.stringify(res2.data).substring(0, 200));
  } catch (e) {
    console.log('  错误:', e.message);
  }
  
  // 测试3: 获取司机模式
  console.log('\n3. 测试 GET /api/driver/mode');
  try {
    const res3 = await testAPI('/api/driver/mode', 'GET', null, token);
    console.log('  状态:', res3.status);
    console.log('  响应:', JSON.stringify(res3.data).substring(0, 200));
  } catch (e) {
    console.log('  错误:', e.message);
  }
  
  // 测试4: GPS位置上报
  console.log('\n4. 测试 POST /api/driver/location');
  try {
    const res4 = await testAPI('/api/driver/location', 'POST', {
      order_id: 1,
      lat: 30.123456,
      lng: 102.123456,
      address: '测试地址',
      speed: 0,
      heading: 0,
      accuracy: 10
    }, token);
    console.log('  状态:', res4.status);
    console.log('  响应:', JSON.stringify(res4.data).substring(0, 200));
  } catch (e) {
    console.log('  错误:', e.message);
  }
  
  // 测试5: 载重限制检查（模拟超重订单）
  console.log('\n5. 测试载重限制（需在有货源时测试）');
  try {
    const goodsRes = await testAPI('/api/goods/list', 'GET', null, token);
    if (goodsRes.data && goodsRes.data.length > 0) {
      const heavyGoods = goodsRes.data.find(g => g.weight > 4500);
      if (heavyGoods) {
        console.log('  找到超重货源（ID:' + heavyGoods.id + '，重量:' + heavyGoods.weight + 'kg）');
        const res5 = await testAPI('/api/driver/take-order', 'POST', { goods_id: heavyGoods.id }, token);
        console.log('  状态:', res5.status);
        console.log('  响应:', JSON.stringify(res5.data).substring(0, 200));
      } else {
        console.log('  ⚠️ 未找到超重货源，跳过测试');
      }
    }
  } catch (e) {
    console.log('  错误:', e.message);
  }
  
  console.log('\n✅ 测试完成！');
}

runTests().catch(console.error);
