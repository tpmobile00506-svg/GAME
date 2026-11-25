import { ARENA, TICK_RATE } from '@armor/shared';

// stub ของเฟส 1: พิสูจน์ว่า Node รัน TypeScript และอ่านแมพเดียวกับ client จาก shared ได้
// เฟส 2 จะเปลี่ยนไฟล์นี้เป็นเซิร์ฟเวอร์ Colyseus (GameRoom + setFixedTimestep(1000 / TICK_RATE))
const solidTiles = ARENA.solid.reduce((count, cell) => count + cell, 0);
console.log(
  `[server] stub OK, TICK_RATE = ${TICK_RATE}, map ${ARENA.width}x${ARENA.height} tiles ` +
    `(${solidTiles} solid, ${ARENA.playerSpawns.length} player spawn). Colyseus comes in phase 2.`,
);
