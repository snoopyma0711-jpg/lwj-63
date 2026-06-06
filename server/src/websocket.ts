import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Comment, Contract, ApprovalNode, WarningRecord, WarningStats } from './types';

let io: Server;

const contractRooms = new Map<string, Set<string>>();
const warningRoom = 'warning:dashboard';

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

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      contractRooms.forEach((sockets) => {
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
