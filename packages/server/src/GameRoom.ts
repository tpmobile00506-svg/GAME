import { Room, type Client, type StepContext as RoomStepContext } from '@colyseus/core';
import {
  ARENA,
  GameStateSchema,
  InputSchema,
  PHYSICS,
  PlayerSchema,
  TICK_RATE,
  WEAPON_SLOTS,
  createPlayer,
  stepPlayer,
  type GameState,
  type InputMessage,
  type StepContext,
} from '@armor/shared';

/**
 * ห้องเกม 1 ห้อง: เซิร์ฟเวอร์ตัดสินทุกอย่าง
 * ทุก tick รับ input คนละ 1 ชุด แล้วเดินเกมด้วย stepPlayer ตัวเดียวกับที่ client ใช้ทำนาย
 */
export class GameRoom extends Room<{ state: GameState; input: InputMessage }> {
  maxClients = 4;
  state = new GameStateSchema();

  // ห้ามเชื่อค่าจาก client: sanitize ดัดค่าที่ผิดช่วงหรือเป็น NaN ให้อยู่ในช่วงที่ถูก ก่อนเกมจะอ่าน
  // (ส่วนกติกาเกม เช่น ปืนต้องมีอยู่จริง stepPlayer เช็กอีกชั้น)
  inputs = this.defineInput(InputSchema, {
    bufferMaxSize: 64,
    sanitize: {
      aim: [-Math.PI, Math.PI],
      switchTo: [0, WEAPON_SLOTS.length],
    },
  });

  onCreate(): void {
    this.setFixedTimestep((ctx) => this.step(ctx), TICK_RATE, { subSteps: PHYSICS.substeps });
  }

  onJoin(client: Client): void {
    const spawns = ARENA.playerSpawns;
    const spawn = spawns[this.state.players.size % spawns.length] ?? { x: 64, y: 64 };
    this.state.players.set(client.sessionId, new PlayerSchema(createPlayer(spawn.x, spawn.y)));
    console.log(`[room ${this.roomId}] join ${client.sessionId} (${this.state.players.size}/${this.maxClients})`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    console.log(`[room ${this.roomId}] leave ${client.sessionId} (${this.state.players.size}/${this.maxClients})`);
  }

  private step(ctx: RoomStepContext): void {
    const stepCtx: StepContext = { dt: ctx.dt, subSteps: ctx.subSteps, subDt: ctx.subDt, isReplay: false };
    this.state.players.forEach((player, sessionId) => {
      // รับไม่เกิน 1 input ต่อ tick ต่อคน ถ้า tick นี้ยังไม่มี input มา ก็ไม่ขยับคนนั้น
      const cmd = this.inputs.get(sessionId).next();
      if (cmd) stepPlayer(player, cmd, ARENA, stepCtx);
    });
  }
}
