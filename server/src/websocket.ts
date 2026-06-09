import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Comment, Contract, ApprovalNode, WarningRecord, WarningStats, RiskScoreDetail, ApprovalEfficiencyStats, TemplateEditLock, ClauseChangeWarning } from './types';
import { getApprovalEfficiencyStats } from './services/approvalEfficiencyService';
import { releaseExpiredLocks, getTemplateEditLock } from './services/dbService';

let io: Server;

const contractRooms = new Map<string, Set<string>>();
const templateRooms = new Map<string, Set<string>>();
const warningRoom = 'warning:dashboard';
const riskRankingRoom = 'risk:ranking';
const efficiencyRoom = 'efficiency:dashboard';
const clauseWarningRoom = 'clause:warning';

let lockCheckInterval: NodeJS.Timeout | null = null;

let efficiencyStatsInterval: NodeJS.Timeout | null = null;

export function initWebSocket(server: HTTPServer): void {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join:contract', (contractId: string) => {
      socket.join(`contract:${contractId}`);
      if (!contractRooms.has(contractId)) {
        contractRooms.set(contractId, new Set());
      }
      contractRooms.get(contractId)!.add(socket.id);
      console.log(`Socket ${socket.id} joined contract ${contractId}`);
    });

    socket.on('leave:contract', (contractId: string) => {
      socket.leave(`contract:${contractId}`);
      contractRooms.get(contractId)?.delete(socket.id);
      console.log(`Socket ${socket.id} left contract ${contractId}`);
    });

    socket.on('join:warning', () => {
      socket.join(warningRoom);
      console.log(`Socket ${socket.id} joined warning dashboard`);
    });

    socket.on('leave:warning', () => {
      socket.leave(warningRoom);
      console.log(`Socket ${socket.id} left warning dashboard`);
    });

    socket.on('join:risk-ranking', () => {
      socket.join(riskRankingRoom);
      console.log(`Socket ${socket.id} joined risk ranking`);
    });

    socket.on('leave:risk-ranking', () => {
      socket.leave(riskRankingRoom);
      console.log(`Socket ${socket.id} left risk ranking`);
    });

    socket.on('join:efficiency', () => {
      socket.join(efficiencyRoom);
      console.log(`Socket ${socket.id} joined efficiency dashboard`);
    });

    socket.on('leave:efficiency', () => {
      socket.leave(efficiencyRoom);
      console.log(`Socket ${socket.id} left efficiency dashboard`);
    });

    socket.on('join:template', (templateId: string) => {
      socket.join(`template:${templateId}`);
      if (!templateRooms.has(templateId)) {
        templateRooms.set(templateId, new Set());
      }
      templateRooms.get(templateId)!.add(socket.id);
      console.log(`Socket ${socket.id} joined template ${templateId}`);
    });

    socket.on('leave:template', (templateId: string) => {
      socket.leave(`template:${templateId}`);
      templateRooms.get(templateId)?.delete(socket.id);
      console.log(`Socket ${socket.id} left template ${templateId}`);
    });

    socket.on('join:clause-warning', () => {
      socket.join(clauseWarningRoom);
      console.log(`Socket ${socket.id} joined clause warning`);
    });

    socket.on('leave:clause-warning', () => {
      socket.leave(clauseWarningRoom);
      console.log(`Socket ${socket.id} left clause warning`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      contractRooms.forEach((sockets) => {
        sockets.delete(socket.id);
      });
      templateRooms.forEach((sockets) => {
        sockets.delete(socket.id);
      });
    });
  });
}

export function broadcastComment(contractId: string, comment: Comment): void {
  if (io) {
    io.to(`contract:${contractId}`).emit('comment:new', comment);
  }
}

export function broadcastApprovalUpdate(contractId: string, data: {
  contract: Contract;
  node?: ApprovalNode;
}): void {
  if (io) {
    io.to(`contract:${contractId}`).emit('approval:update', data);
  }
}

export function broadcastStatusUpdate(contractId: string, contract: Contract): void {
  if (io) {
    io.to(`contract:${contractId}`).emit('contract:status', contract);
  }
}

export function broadcastWarningStatsUpdate(stats: WarningStats): void {
  if (io) {
    io.to(warningRoom).emit('warning:stats', stats);
  }
}

export function broadcastWarningRecordUpdate(records: WarningRecord[]): void {
  if (io) {
    io.to(warningRoom).emit('warning:records', records);
  }
}

export function broadcastRiskScoreUpdate(contractId: string, data: {
  contract: Contract;
  riskDetail: RiskScoreDetail;
}): void {
  if (io) {
    io.to(`contract:${contractId}`).emit('risk:score-update', data);
    io.to('risk:ranking').emit('risk:ranking-update');
  }
}

export function broadcastApprovalEfficiencyUpdate(stats: ApprovalEfficiencyStats): void {
  if (io) {
    io.to(efficiencyRoom).emit('efficiency:update', stats);
  }
}

export async function broadcastEfficiencyStats(): Promise<void> {
  try {
    const stats = await getApprovalEfficiencyStats();
    broadcastApprovalEfficiencyUpdate(stats);
  } catch (error) {
    console.error('Failed to broadcast efficiency stats:', error);
  }
}

export function startEfficiencyStatsScheduler(): void {
  if (efficiencyStatsInterval) {
    clearInterval(efficiencyStatsInterval);
  }
  efficiencyStatsInterval = setInterval(() => {
    broadcastEfficiencyStats();
  }, 10000);

  broadcastEfficiencyStats();
}

export function stopEfficiencyStatsScheduler(): void {
  if (efficiencyStatsInterval) {
    clearInterval(efficiencyStatsInterval);
    efficiencyStatsInterval = null;
  }
}

export function broadcastTemplateLockUpdate(
  templateId: string,
  data: {
    lock: TemplateEditLock | null;
    action: 'acquired' | 'released' | 'refreshed' | 'timeout';
  }
): void {
  if (io) {
    io.to(`template:${templateId}`).emit('template:lock-update', data);
  }
}

export function broadcastTemplateVersionUpdate(
  templateId: string,
  data: {
    versionNumber: number;
    action: 'created' | 'rolled_back';
  }
): void {
  if (io) {
    io.to(`template:${templateId}`).emit('template:version-update', data);
  }
}

export async function checkAndReleaseExpiredLocks(): Promise<void> {
  try {
    const expiredTemplateIds = await releaseExpiredLocks(5 * 60 * 1000);
    for (const templateId of expiredTemplateIds) {
      const lock = await getTemplateEditLock(templateId);
      broadcastTemplateLockUpdate(templateId, {
        lock: null,
        action: 'timeout'
      });
      console.log(`自动释放模板 ${templateId} 的编辑锁（超时）`);
    }
  } catch (error) {
    console.error('检查并释放过期锁失败:', error);
  }
}

export function startTemplateLockScheduler(): void {
  if (lockCheckInterval) {
    clearInterval(lockCheckInterval);
  }
  lockCheckInterval = setInterval(() => {
    checkAndReleaseExpiredLocks();
  }, 30000);
}

export function stopTemplateLockScheduler(): void {
  if (lockCheckInterval) {
    clearInterval(lockCheckInterval);
    lockCheckInterval = null;
  }
}

export function broadcastClauseWarningUpdate(warning: ClauseChangeWarning): void {
  if (io) {
    io.to(clauseWarningRoom).emit('clause:warning', warning);
  }
}
