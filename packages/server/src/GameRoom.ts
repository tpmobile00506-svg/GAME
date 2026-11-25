import { Room, type Client, type StepContext as RoomStepContext } from '@colyseus/core';
import {
  ARENA,
  GameStateSchema,
  InputSchema,
  PHYSICS,
  PlayerSchema,
  TICK_RATE,
  createPlayer,
  emptyInput,
  pickSpawn,
  stepPlayer,
  type GameState,
  type InputMessage,
  type StepContext,
} from '@armor/shared';

/**
 * ผู้เล่นไม่ส่ง input มากี่ tick ติดกัน เซิร์ฟเวอร์ถึงจะเดินเกมให้เองด้วย input ว่าง
 * ช่วงสั้นๆ ให้รอ input จริง (เน็ตกระตุกปกติ จะได้ไม่เดินนำ client) ถ้าหายนานกว่านี้ ตัวละครต้องตกตามแรงโน้มถ่วง
 * กันการลอยค้างกลางอากาศด้วยการหยุดส่ง packet และตอนผู้เล่นสลับแท็บ (6 tick = 0.2 วินาที)
 */
const IDLE_GRACE_TICKS = 6;

/**
 * ห้องเกม 1 ห้อง: เซิร์ฟเวอร์ตัดสินทุกอย่าง
 * ทุก tick รับ input คนละไม่เกิน 1 ชุด แล้วเดินเกมด้วย stepPlayer ตัวเดียวกับที่ client ใช้ทำนาย
 */
export class GameRoom extends Room<{ state: GameState; input: InputMessage }> {
  maxClients = 4;
  state = new GameStateSchema();
  private readonly missedTicks = new Map<string, number>();

  // ห้ามเชื่อค่าจาก client: sanitize ดัดมุมที่ผิดช่วงหรือเป็น NaN ให้อยู่ในช่วงที่ถูกก่อนเกมจะอ่าน
  // ส่วน switchTo ไม่ต้องดัด เพราะ stepPlayer ไม่สนค่าที่ไม่ใช่ช่องปืนจริงอยู่แล้ว
  inputs = this.defineInput(InputSchema, {
    bufferMaxSize: 64,
    sanitize: { aim: [-Math.PI, Math.PI] },
  });

  onCreate(): void {
    this.setFixedTimestep((ctx) => this.step(ctx), TICK_RATE, { subSteps: PHYSICS.substeps });
  }

  onJoin(client: Client): void {
    const others = [...this.state.players.values()].map((p) => ({ x: p.x, y: p.y + PHYSICS.halfHeight }));
    const spawn = pickSpawn(ARENA.playerSpawns, others);
    this.state.players.set(client.sessionId, new PlayerSchema(createPlayer(spawn.x, spawn.y)));
    console.log(`[room ${this.roomId}] join ${client.sessionId} (${this.state.players.size}/${this.maxClients})`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.missedTicks.delete(client.sessionId);
    console.log(`[room ${this.roomId}] leave ${client.sessionId} (${this.state.players.size}/${this.maxClients})`);
  }

  private step(ctx: RoomStepContext): void {
    const stepCtx: StepContext = { dt: ctx.dt, subSteps: ctx.subSteps, subDt: ctx.subDt, isReplay: false };
    this.state.players.forEach((player, sessionId) => {
      const cmd = this.inputs.get(sessionId).next();
      if (cmd) {
        this.missedTicks.set(sessionId, 0);
        stepPlayer(player, cmd, ARENA, stepCtx);
        return;
      }
      const missed = (this.missedTicks.get(sessionId) ?? 0) + 1;
      this.missedTicks.set(sessionId, missed);
      if (missed > IDLE_GRACE_TICKS) stepPlayer(player, emptyInput(player.aim), ARENA, stepCtx);
    });
  }
}
