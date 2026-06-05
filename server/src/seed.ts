import { getDb } from './db';
import { createTemplate, createUser, getUser } from './services/dbService';
import { v4 as uuidv4 } from 'uuid';

export async function seedData(): Promise<void> {
  const db = await getDb();
  const userCheck = await db.get('SELECT COUNT(*) as count FROM users') as any;
  if (userCheck.count > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }

  console.log('正在初始化示例数据...');

  const specialist = await createUser('张法务', 'specialist');
  const manager = await createUser('李经理', 'manager');
  const director = await createUser('王总监', 'director');

  const templateClauses = [
    {
      id: uuidv4(),
      number: '1',
      title: '合同双方',
      content: '甲方：[公司名称]，统一社会信用代码：[代码]。乙方：[客户名称]，统一社会信用代码：[代码]。双方经友好协商，达成如下协议。'
    },
    {
      id: uuidv4(),
      number: '2',
      title: '服务内容',
      content: '甲方同意按照本合同约定向乙方提供专业咨询服务，服务范围详见附件一。乙方应配合甲方提供必要的资料和协助。'
    },
    {
      id: uuidv4(),
      number: '3',
      title: '合同期限',
      content: '本合同有效期自[开始日期]起至[结束日期]止，共计[X]个月。合同期满前30日，如双方均未提出终止，则自动延续一年。'
    },
    {
      id: uuidv4(),
      number: '4',
      title: '费用及支付',
      content: '本合同总费用为人民币[X]元整（￥[X]）。乙方应在合同签订后10个工作日内支付50%预付款，剩余款项在服务验收合格后10个工作日内付清。'
    },
    {
      id: uuidv4(),
      number: '5',
      title: '保密条款',
      content: '双方应对在合作过程中知悉的对方商业秘密、技术信息以及其他未公开的信息承担保密义务，未经对方书面同意，不得向任何第三方泄露。保密义务在合同终止后三年内仍然有效。'
    },
    {
      id: uuidv4(),
      number: '6',
      title: '违约责任',
      content: '任何一方违反本合同约定，应向守约方支付合同总金额20%的违约金，并赔偿由此给守约方造成的全部损失。'
    },
    {
      id: uuidv4(),
      number: '7',
      title: '争议解决',
      content: '因本合同引起的或与本合同有关的任何争议，双方应友好协商解决；协商不成的，任何一方有权向甲方所在地有管辖权的人民法院提起诉讼。'
    },
    {
      id: uuidv4(),
      number: '8',
      title: '其他约定',
      content: '本合同一式两份，甲乙双方各执一份，具有同等法律效力。本合同自双方签字盖章之日起生效。'
    }
  ];

  await createTemplate('标准服务合同模板', templateClauses);
  await createTemplate('标准采购合同模板', [
    {
      id: uuidv4(),
      number: '1',
      title: '采购标的',
      content: '乙方向甲方供应货物，货物名称、规格、数量、价格详见附件一。'
    },
    {
      id: uuidv4(),
      number: '2',
      title: '质量标准',
      content: '货物质量应符合国家标准、行业标准及甲方要求。'
    },
    {
      id: uuidv4(),
      number: '3',
      title: '交付方式',
      content: '乙方应在[日期]前将货物送至甲方指定地点。'
    }
  ]);

  console.log('示例数据初始化完成');
  console.log('用户账号：', { specialist, manager, director });
}
