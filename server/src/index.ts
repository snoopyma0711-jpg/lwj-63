import express from 'express';
import cors from 'cors';
import http from 'http';
import routes from './routes';
import { initWebSocket, startEfficiencyStatsScheduler } from './websocket';
import { seedData } from './seed';
import { initDefaultWarningRules, initDefaultApprovalTimeoutConfigs } from './services/dbService';
import { startWarningScanScheduler } from './services/warningScanService';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', routes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initWebSocket(server);

async function start() {
  await seedData();
  await initDefaultWarningRules();
  await initDefaultApprovalTimeoutConfigs();
  startWarningScanScheduler();
  startEfficiencyStatsScheduler();
  server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`WebSocket 已启动`);
  });
}

start();
