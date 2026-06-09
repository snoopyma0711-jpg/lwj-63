import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

async function testClauseGraph() {
  console.log('=== 开始测试条款知识图谱模块 ===\n');

  try {
    console.log('1. 测试创建条款关联关系...');
    
    const rel1 = await axios.post(`${API_BASE}/clause-relations`, {
      clauseNumberA: '1.1',
      clauseNumberB: '2.3',
      relationType: '引用',
      description: '条款1.1引用了条款2.3的定义',
      createdBy: 'user1',
      createdByName: '张三'
    });
    console.log('✓ 创建引用关系成功:', rel1.data.id);

    const rel2 = await axios.post(`${API_BASE}/clause-relations`, {
      clauseNumberA: '2.3',
      clauseNumberB: '5.1',
      relationType: '冲突',
      description: '条款2.3与条款5.1在违约金计算上存在冲突',
      createdBy: 'user1',
      createdByName: '张三'
    });
    console.log('✓ 创建冲突关系成功:', rel2.data.id);

    const rel3 = await axios.post(`${API_BASE}/clause-relations`, {
      clauseNumberA: '1.1',
      clauseNumberB: '3.2',
      relationType: '补充',
      description: '条款3.2对条款1.1的付款方式进行了补充说明',
      createdBy: 'user2',
      createdByName: '李四'
    });
    console.log('✓ 创建补充关系成功:', rel3.data.id);

    const rel4 = await axios.post(`${API_BASE}/clause-relations`, {
      clauseNumberA: '5.1',
      clauseNumberB: '7.8',
      relationType: '替代',
      description: '条款7.8可替代条款5.1的争议解决方式',
      createdBy: 'user1',
      createdByName: '张三'
    });
    console.log('✓ 创建替代关系成功:', rel4.data.id);

    console.log('\n2. 测试重复关联拒绝...');
    try {
      await axios.post(`${API_BASE}/clause-relations`, {
        clauseNumberA: '1.1',
        clauseNumberB: '2.3',
        relationType: '冲突',
        description: '测试重复关联',
        createdBy: 'user1',
        createdByName: '张三'
      });
      console.log('✗ 应该拒绝重复关联但没有拒绝');
    } catch (err: any) {
      console.log('✓ 正确拒绝重复关联:', err.response?.data?.error);
    }

    console.log('\n3. 测试自身关联拒绝...');
    try {
      await axios.post(`${API_BASE}/clause-relations`, {
        clauseNumberA: '1.1',
        clauseNumberB: '1.1',
        relationType: '引用',
        description: '测试自身关联',
        createdBy: 'user1',
        createdByName: '张三'
      });
      console.log('✗ 应该拒绝自身关联但没有拒绝');
    } catch (err: any) {
      console.log('✓ 正确拒绝自身关联:', err.response?.data?.error);
    }

    console.log('\n4. 测试按条款编号查询关联...');
    const relations = await axios.get(`${API_BASE}/clause-relations?clauseNumber=1.1`);
    console.log(`✓ 查询到条款1.1的关联共 ${relations.data.length} 条:`);
    relations.data.forEach((r: any) => {
      console.log(`   - ${r.clauseNumberA} <-> ${r.clauseNumberB} [${r.relationType}]`);
    });

    console.log('\n5. 测试按关键字搜索...');
    const searchResult = await axios.get(`${API_BASE}/clause-relations?keyword=违约金`);
    console.log(`✓ 搜索"违约金"找到 ${searchResult.data.length} 条关联`);

    console.log('\n6. 测试按关系类型筛选...');
    const conflictResult = await axios.get(`${API_BASE}/clause-relations?relationType=冲突`);
    console.log(`✓ 筛选冲突关系找到 ${conflictResult.data.length} 条`);

    console.log('\n7. 测试影响分析（条款2.3）...');
    const impact = await axios.get(`${API_BASE}/clause-relations/impact-analysis?clauseNumber=2.3`);
    console.log(`✓ 影响分析结果:`);
    console.log(`   直接关联:`);
    for (const [type, rels] of Object.entries(impact.data.directRelations)) {
      console.log(`     ${type}: ${(rels as any[]).length} 条`);
      (rels as any[]).forEach((r: any) => {
        console.log(`       - ${r.clauseNumberA} <-> ${r.clauseNumberB}`);
      });
    }
    console.log(`   间接关联:`);
    for (const [type, rels] of Object.entries(impact.data.indirectRelations)) {
      console.log(`     ${type}: ${(rels as any[]).length} 条`);
      (rels as any[]).forEach((r: any) => {
        console.log(`       - ${r.clauseNumberA} <-> ${r.clauseNumberB}`);
      });
    }

    console.log('\n8. 测试查询预警记录（空）...');
    const warnings = await axios.get(`${API_BASE}/clause-change-warnings`);
    console.log(`✓ 当前预警记录数: ${warnings.data.length}`);

    console.log('\n9. 测试删除关联关系...');
    const deleteResult = await axios.delete(`${API_BASE}/clause-relations/${rel4.data.id}`);
    console.log('✓ 删除成功:', deleteResult.data.success);

    console.log('\n10. 测试删除不存在的关联...');
    try {
      await axios.delete(`${API_BASE}/clause-relations/nonexistent-id`);
      console.log('✗ 应该返回404但没有');
    } catch (err: any) {
      console.log('✓ 正确返回404:', err.response?.status);
    }

    console.log('\n=== 基础API测试完成 ===');
    console.log('\n提示: 要测试条款变更预警功能，请先创建一个合同，');
    console.log('      然后使用 POST /api/contracts/:id/new-version 创建新版本。');

  } catch (err: any) {
    console.error('✗ 测试失败:', err.response?.data?.error || err.message);
    if (err.response?.data) {
      console.error('  详细错误:', err.response.data);
    }
    process.exit(1);
  }
}

testClauseGraph();
