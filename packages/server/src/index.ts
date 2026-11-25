import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { TICK_RATE } from '@armor/shared';
import { GameRoom } from './GameRoom.ts';

// จำลองเน็ตแลคตอนทดสอบ: ตั้งตัวแปร COLYSEUS_LATENCY (มิลลิวินาที ไป-กลับ) ก่อนรัน เช่น
//   $env:COLYSEUS_LATENCY = '150'; pnpm dev:server
const port = Number(process.env.PORT ?? 2567);

const server = new Server({ transport: new WebSocketTransport(), greet: false });
server.define('game', GameRoom);
await server.listen(port);

console.log(
  `[server] ws://localhost:${port} · ${TICK_RATE} tick/s · simulated latency ${process.env.COLYSEUS_LATENCY ?? 0} ms`,
);
