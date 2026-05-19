// 测试脚本 - 验证新实现的API
const http = require('http');

const BASE_URL = 'http://localhost:3458';

// 测试获取用户权限
function testGetPermissions() {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}/api/user/permissions`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ GET /api/user/permissions 测试完成');
        console.log('   响应:', data);
        resolve();
      });
    }).on('error', reject);
  });
}

// 测试获取乡镇覆盖统计
function testGetTownshipCoverage() {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}/api/townships/coverage`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ GET /api/townships/coverage 测试完成');
        console.log('   响应:', data);
        resolve();
      });
    }).on('error', reject);
  });
}

// 运行测试
async function runTests() {
  console.log('开始测试...\n');
  
  try {
    await testGetPermissions();
    await testGetTownshipCoverage();
    console.log('\n✅ 所有测试完成');
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
  }
}

runTests();
