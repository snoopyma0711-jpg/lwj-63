const http = require('http');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
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

async function test() {
  console.log('========== API端到端测试 ==========\n');

  // 0. 获取模板列表
  console.log('0. 获取模板列表...');
  const templates = await makeRequest('GET', '/templates');
  console.log('   可用模板:', templates.map(t => ({ id: t.id, name: t.name })));
  
  if (templates.length === 0) {
    console.log('   ❌ 没有可用模板');
    process.exit(1);
  }

  const templateId = templates[0].id;
  console.log('   使用模板:', templateId);

  // 1. 创建新合同，包含用户提到的文本
  console.log('\n1. 创建新合同...');
  const contractData = {
    title: '测试合同-付款方式和违约金提取',
    templateId: templateId,
    rawContent: `第一条 合同双方
甲方：某某科技有限公司
乙方：某某供应商有限公司

第二条 服务内容
提供专业咨询服务。

第三条 合同期限
本合同自2024年01月01日起至2024年12月31日止。

第四条 费用及支付
合同总金额：人民币200,000元整。10个工作日内支付50%预付款，验收合格后10个工作日内支付50%。

第五条 违约责任
任何一方违反合同约定，应支付合同总金额30%的违约金。

第六条 保密条款
保密期限：合同终止后2年。
`,
    submittedBy: 'c8eb26ad-2524-4877-aa6d-c7d4f8a4727a',
    submittedByName: '张法务'
  };

  const contract = await makeRequest('POST', '/contracts', contractData);
  console.log('   ✅ 合同创建成功，ID:', contract.id);

  // 2. 比对合同
  console.log('\n2. 比对合同并获取摘要...');
  const compareResult = await makeRequest('GET', `/contracts/${contract.id}/compare`);
  console.log('   API返回 keys:', Object.keys(compareResult));

  // 3. 检查摘要提取结果
  console.log('\n3. 检查摘要提取结果:');
  let summary;
  if (compareResult.summary) {
    summary = compareResult.summary;
  } else if (compareResult.newContract && compareResult.newContract.summary) {
    summary = compareResult.newContract.summary;
  } else if (compareResult.data && compareResult.data.summary) {
    summary = compareResult.data.summary;
  } else {
    console.log('   ❌ 无法找到summary字段');
    console.log('   完整返回:', JSON.stringify(compareResult, null, 2));
    process.exit(1);
  }

  console.log(`   甲方: ${summary.partyA || '未识别'}`);
  console.log(`   乙方: ${summary.partyB || '未识别'}`);
  console.log(`   合同金额: ${summary.contractAmount || '未识别'}`);
  console.log(`   付款方式: ${summary.paymentMethod || '未识别'}`);
  console.log(`   违约金比例: ${summary.penaltyRatio || '未识别'}`);
  console.log(`   保密期限: ${summary.confidentialityPeriod || '未识别'}`);

  // 4. 验证结果
  console.log('\n4. 验证结果:');
  let allPassed = true;

  const expectedPayment = '10个工作日内支付50%预付款，验收合格后10个工作日内支付50%';
  const expectedPenalty = '任何一方违反合同约定，应支付合同总金额30%的违约金';

  if (summary.paymentMethod === expectedPayment) {
    console.log('   ✅ 付款方式提取正确');
  } else {
    console.log('   ❌ 付款方式提取错误');
    console.log(`      预期: "${expectedPayment}"`);
    console.log(`      实际: "${summary.paymentMethod}"`);
    allPassed = false;
  }

  if (summary.penaltyRatio === expectedPenalty) {
    console.log('   ✅ 违约金比例提取正确');
  } else {
    console.log('   ❌ 违约金比例提取错误');
    console.log(`      预期: "${expectedPenalty}"`);
    console.log(`      实际: "${summary.penaltyRatio}"`);
    allPassed = false;
  }

  console.log('\n========== 测试总结 ==========\n');
  if (allPassed) {
    console.log('✅ 所有API测试通过！付款方式和违约金比例都能正确识别。');
  } else {
    console.log('❌ 部分测试失败，请检查。');
    process.exit(1);
  }
}

test().catch(console.error);
