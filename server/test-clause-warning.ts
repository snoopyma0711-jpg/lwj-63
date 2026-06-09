import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

async function testClauseWarning() {
  console.log('=== 开始测试条款变更预警功能 ===\n');

  try {
    console.log('1. 创建测试模板...');
    const template = await axios.post(`${API_BASE}/templates`, {
      name: '测试合同模板',
      clauses: [
        { id: '1', number: '1.1', title: '合同主体', content: '甲方：北京XX公司，乙方：上海YY公司' },
        { id: '2', number: '2.3', title: '付款方式', content: '乙方应在每月5日前支付当月服务费' },
        { id: '3', number: '5.1', title: '违约金', content: '逾期付款按每日0.1%支付违约金' },
        { id: '4', number: '3.2', title: '付款账户', content: '付款账户：招商银行 6226xxxxxxxxxx' }
      ],
      createdBy: 'user1',
      createdByName: '张三'
    });
    console.log('✓ 模板创建成功:', template.data.id);

    console.log('\n2. 创建测试合同...');
    const contract = await axios.post(`${API_BASE}/contracts`, {
      title: '测试服务合同',
      templateId: template.data.id,
      rawContent: `1.1 合同主体
甲方：北京XX公司，乙方：上海YY公司

2.3 付款方式
乙方应在每月5日前支付当月服务费

5.1 违约金
逾期付款按每日0.1%支付违约金

3.2 付款账户
付款账户：招商银行 6226xxxxxxxxxx`,
      submittedBy: 'user1',
      submittedByName: '张三'
    });
    console.log('✓ 合同创建成功:', contract.data.id);

    console.log('\n3. 建立条款关联关系...');
    await axios.post(`${API_BASE}/clause-relations`, {
      clauseNumberA: '2.3',
      clauseNumberB: '5.1',
      relationType: '引用',
      description: '付款方式引用了违约金条款',
      createdBy: 'user1',
      createdByName: '张三'
    });
    await axios.post(`${API_BASE}/clause-relations`, {
      clauseNumberA: '2.3',
      clauseNumberB: '3.2',
      relationType: '补充',
      description: '付款账户补充说明付款方式',
      createdBy: 'user1',
      createdByName: '张三'
    });
    console.log('✓ 关联关系创建完成');

    console.log('\n4. 创建合同新版本（修改条款2.3和5.1）...');
    const newVersion = await axios.post(`${API_BASE}/contracts/${contract.data.id}/new-version`, {
      rawContent: `1.1 合同主体
甲方：北京XX公司，乙方：上海YY公司

2.3 付款方式
乙方应在每月10日前支付当月服务费（已修改）

5.1 违约金
逾期付款按每日0.05%支付违约金（已修改）

3.2 付款账户
付款账户：招商银行 6226xxxxxxxxxx`,
      submittedBy: 'user1',
      submittedByName: '张三'
    });
    console.log('✓ 新版本创建成功，版本号:', newVersion.data.version);

    console.log('\n5. 检查生成的预警记录...');
    const warnings = await axios.get(`${API_BASE}/clause-change-warnings`);
    console.log(`✓ 生成预警记录数: ${warnings.data.length}`);
    warnings.data.forEach((w: any, i: number) => {
      console.log(`\n  预警 ${i + 1}:`);
      console.log(`    变更条款: ${w.changedClauseNumber} (${w.changedClauseTitle})`);
      console.log(`    受影响条款: ${w.affectedClauseNumbers.join(', ')}`);
      console.log(`    关系类型: ${w.relationType}`);
      console.log(`    状态: ${w.status}`);
      console.log(`    变更时间: ${w.changedAt}`);
    });

    console.log('\n6. 测试按时间范围筛选预警...');
    const now = new Date();
    const startTime = new Date(now.getTime() - 3600000).toISOString();
    const endTime = new Date(now.getTime() + 3600000).toISOString();
    const filteredWarnings = await axios.get(
      `${API_BASE}/clause-change-warnings?startTime=${startTime}&endTime=${endTime}`
    );
    console.log(`✓ 时间范围内预警数: ${filteredWarnings.data.length}`);

    console.log('\n7. 测试更新预警状态...');
    if (warnings.data.length > 0) {
      const updateResult = await axios.put(
        `${API_BASE}/clause-change-warnings/${warnings.data[0].id}/status`,
        { status: 'handled' }
      );
      console.log('✓ 预警状态更新成功:', updateResult.data.success);

      const updatedWarnings = await axios.get(`${API_BASE}/clause-change-warnings?status=handled`);
      console.log(`✓ 已处理预警数: ${updatedWarnings.data.length}`);
    }

    console.log('\n8. 测试按合同ID筛选预警...');
    const contractWarnings = await axios.get(
      `${API_BASE}/clause-change-warnings?contractId=${newVersion.data.id}`
    );
    console.log(`✓ 合同${newVersion.data.id}的预警数: ${contractWarnings.data.length}`);

    console.log('\n=== 条款变更预警测试完成 ===');

  } catch (err: any) {
    console.error('✗ 测试失败:', err.response?.data?.error || err.message);
    if (err.response?.data) {
      console.error('  详细错误:', err.response.data);
    }
    console.error('  Stack:', err.stack);
    process.exit(1);
  }
}

testClauseWarning();
