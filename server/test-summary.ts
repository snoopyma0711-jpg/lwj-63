import { extractContractSummary } from './src/services/summaryExtractionService';

// 测试用例1 - 用户提到的场景：费用及支付条款
const testContent1 = `
第一条 合同双方
甲方：示例科技有限公司
乙方：优质供应商有限公司

第二条 服务内容
提供技术开发服务。

第三条 合同期限
本合同自2024年01月01日起至2024年12月31日止。

第四条 费用及支付
本合同总金额为人民币1,000,000元整。合同签订后10个工作日内支付50%预付款，验收合格后10个工作日内支付50%。

第五条 违约责任
任何一方违反本合同约定，应向守约方支付合同总金额30%的违约金。

第六条 保密条款
双方应对合作过程中知悉的商业秘密承担保密义务，保密期限为合同终止后3年。
`;

// 测试用例2 - 另一种表述
const testContent2 = `
第一条 合同双方
甲方：示例科技有限公司
乙方：优质供应商有限公司

第四条 费用及支付
合同总金额：人民币500,000元整。10个工作日内支付50%预付款，验收合格后付余款。

第五条 违约责任
如乙方逾期交付，每逾期一日支付合同金额0.5%的违约金。

第六条 保密条款
保密期限3年。
`;

// 测试用例3 - 用户具体提到的文本
const testContent3 = `
甲方：某某科技有限公司
乙方：某某供应商有限公司

一、服务内容
提供专业咨询服务。

二、费用及支付
合同总金额：人民币200,000元整。10个工作日内支付50%预付款，验收合格后10个工作日内支付50%。

三、违约责任
任何一方违反合同约定，应支付合同总金额30%的违约金。

四、保密条款
保密期限：合同终止后2年。
`;

// 测试用例4 - 有明确的付款方式标题
const testContent4 = `
付款方式：
合同签订后10个工作日内支付50%预付款，验收合格后10个工作日内支付45%，质保期满后10个工作日内支付5%。

违约金：
合同总金额20%的违约金。
`;

// 测试用例5 - 日利率违约金
const testContent5 = `
违约责任：
每逾期一日，按应付金额的万分之五支付违约金。
`;

// 测试用例6 - 另一种违约金表述
const testContent6 = `
第六条 违约责任
1、甲方逾期付款的，每逾期一日应向乙方支付逾期金额0.3%的违约金；
2、乙方逾期交付的，每逾期一日应向甲方支付合同总金额0.5%的违约金。
`;

function runTest(name: string, content: string, expectedPayment: string, expectedPenalty: string) {
  console.log(`\n=== ${name} ===\n`);
  const result = extractContractSummary(content);
  
  console.log('提取结果:');
  console.log('  甲方:', result.partyA || '未识别');
  console.log('  乙方:', result.partyB || '未识别');
  console.log('  合同金额:', result.contractAmount || '未识别');
  console.log('  生效日期:', result.effectiveDate || '未识别');
  console.log('  到期日期:', result.expiryDate || '未识别');
  console.log('  付款方式:', result.paymentMethod || '未识别');
  console.log('  违约金比例:', result.penaltyRatio || '未识别');
  console.log('  保密期限:', result.confidentialityPeriod || '未识别');

  console.log('\n验证:');
  const norm = (v: string | null) => v === null ? '未识别' : v;
  const paymentOk = norm(result.paymentMethod) === expectedPayment;
  const penaltyOk = norm(result.penaltyRatio) === expectedPenalty;
  console.log(`  付款方式: ${paymentOk ? '✅ 通过' : '❌ 失败'}`);
  if (!paymentOk) {
    console.log(`    预期: "${expectedPayment}"`);
    console.log(`    实际: "${norm(result.paymentMethod)}"`);
  }
  console.log(`  违约金比例: ${penaltyOk ? '✅ 通过' : '❌ 失败'}`);
  if (!penaltyOk) {
    console.log(`    预期: "${expectedPenalty}"`);
    console.log(`    实际: "${norm(result.penaltyRatio)}"`);
  }

  return paymentOk && penaltyOk;
}

console.log('========== 合同摘要提取逻辑测试 ==========\n');

let allPassed = true;

allPassed = runTest(
  '测试用例1 - 费用及支付条款',
  testContent1,
  '合同签订后10个工作日内支付50%预付款，验收合格后10个工作日内支付50%',
  '任何一方违反本合同约定，应向守约方支付合同总金额30%的违约金'
) && allPassed;

allPassed = runTest(
  '测试用例2 - 另一种表述',
  testContent2,
  '10个工作日内支付50%预付款，验收合格后付余款',
  '如乙方逾期交付，每逾期一日支付合同金额0.5%的违约金'
) && allPassed;

allPassed = runTest(
  '测试用例3 - 用户具体提到的文本',
  testContent3,
  '10个工作日内支付50%预付款，验收合格后10个工作日内支付50%',
  '任何一方违反合同约定，应支付合同总金额30%的违约金'
) && allPassed;

allPassed = runTest(
  '测试用例4 - 明确的付款方式标题',
  testContent4,
  '合同签订后10个工作日内支付50%预付款，验收合格后10个工作日内支付45%，质保期满后10个工作日内支付5%',
  '合同总金额20%的违约金'
) && allPassed;

allPassed = runTest(
  '测试用例5 - 日利率违约金',
  testContent5,
  '未识别',
  '每逾期一日，按应付金额的万分之五支付违约金'
) && allPassed;

console.log('\n========== 测试总结 ==========\n');
console.log(allPassed ? '✅ 所有测试通过！' : '❌ 部分测试失败，请检查。');
