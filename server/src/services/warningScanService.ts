import cron from 'node-cron';
import {
  getApprovedContractsWithExpiry,
  getWarningRules,
  getWarningRecordByContractAndLevel,
  createWarningRecord,
  getWarningRecords,
  getWarningStats
} from './dbService';
import { broadcastWarningRecordUpdate, broadcastWarningStatsUpdate } from '../websocket';
import { WarningRule, WarningLevel } from '../types';

function calculateDaysRemaining(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getApplicableWarningRule(
  daysRemaining: number,
  rules: WarningRule[]
): WarningRule | null {
  const sortedRules = [...rules].sort((a, b) => a.days - b.days);
  for (const rule of sortedRules) {
    if (daysRemaining <= rule.days) {
      return rule;
    }
  }
  return null;
}

export async function scanContractsForWarnings(): Promise<void> {
  console.log('开始扫描合同到期预警...', new Date().toISOString());

  try {
    const contracts = await getApprovedContractsWithExpiry();
    const rules = await getWarningRules();

    if (rules.length === 0) {
      console.log('未配置预警规则，跳过扫描');
      return;
    }

    let newWarningsCount = 0;

    for (const contract of contracts) {
      if (!contract.expiryDate) continue;

      const daysRemaining = calculateDaysRemaining(contract.expiryDate);

      if (daysRemaining < 0) continue;

      const applicableRule = getApplicableWarningRule(daysRemaining, rules);
      if (!applicableRule) continue;

      const existingRecord = await getWarningRecordByContractAndLevel(
        contract.id,
        applicableRule.level as WarningLevel
      );

      if (!existingRecord) {
        await createWarningRecord({
          contractId: contract.id,
          contractTitle: contract.title,
          expiryDate: contract.expiryDate,
          daysRemaining,
          warningLevel: applicableRule.level as WarningLevel,
          warningColor: applicableRule.color
        });
        newWarningsCount++;
        console.log(`生成预警: ${contract.title} - ${daysRemaining}天后到期 - ${applicableRule.level}`);
      }
    }

    if (newWarningsCount > 0) {
      const records = await getWarningRecords();
      const stats = await getWarningStats();
      broadcastWarningRecordUpdate(records);
      broadcastWarningStatsUpdate(stats);
    }

    console.log(`扫描完成，新增${newWarningsCount}条预警记录`);
  } catch (error) {
    console.error('扫描合同预警时出错:', error);
  }
}

export function startWarningScanScheduler(): void {
  console.log('预警扫描调度器已启动');
  console.log('执行时间: 每天凌晨 00:01');

  cron.schedule('1 0 * * *', () => {
    scanContractsForWarnings();
  });

  setTimeout(() => {
    scanContractsForWarnings();
  }, 3000);
}

export default { startWarningScanScheduler, scanContractsForWarnings };
