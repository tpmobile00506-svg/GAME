import { describe, expect, it } from 'vitest';
import { TICK_RATE } from './index.ts';
import { ARENA, type GameMap } from './map.ts';
import type { PlayerInput } from './messages.ts';
import { PHYSICS, createPlayer, resolveShot, stepPlayer, traceRay, type PlayerState, type ShotEvent, type StepContext } from './step.ts';
import { WEAPONS, WEAPON_SLOTS } from './weapons.ts';

/** สร้างแมพทดสอบจากตัวอักษร: '#' = tile ชนได้, '.' = ว่าง */
function mapFromAscii(rows: readonly string[]): GameMap {
  const width = rows[0]?.length ?? 0;
  const solid = new Uint8Array(width * rows.length);
  rows.forEach((row, ty) => {
    [...row].forEach((ch, tx) => {
      solid[ty * width + tx] = ch === '#' ? 1 : 0;
    });
  });
  return { width, height: rows.length, tileSize: 32, solid, playerSpawns: [{ x: 0, y: 0 }], dummySpawns: [] };
}

// ห้อง 12 × 10 tile: พื้นด้านล่างผิวบนอยู่ที่ y = 288, หิ้งซ้ายผิวบนอยู่ที่ y = 160 (คอลัมน์ 1–4)
const ROOM = mapFromAscii([
  '############',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#####......#',
  '#..........#',
  '#..........#',
  '#..........#',
  '############',
]);
const FLOOR_Y = 9 * 32;
const LEDGE_Y = 5 * 32;

const CTX: StepContext = { dt: 1 / TICK_RATE, isReplay: false };
const IDLE: PlayerInput = { left: false, right: false, jump: false, fire: false, aim: 0, weapon: 'pistol' };

function tick(p: PlayerState, map: GameMap, input: Partial<PlayerInput> = {}): ShotEvent | null {
  return stepPlayer(p, { ...IDLE, weapon: p.weapon, ...input }, map, CTX);
}

function ticks(p: PlayerState, map: GameMap, n: number, input: Partial<PlayerInput> = {}): ShotEvent[] {
  const shots: ShotEvent[] = [];
  for (let i = 0; i < n; i++) {
    const shot = tick(p, map, input);
    if (shot) shots.push(shot);
  }
  return shots;
}

/** ผู้เล่นที่ยืนนิ่งบนพื้นห้องแล้ว */
function standingPlayer(x: number): PlayerState {
  const p = createPlayer(x, FLOOR_Y);
  ticks(p, ROOM, 3);
  return p;
}

describe('การเคลื่อนที่และการชน', () => {
  it('ตกลงมาแล้วยืนบนพื้นพอดีขอบ tile', () => {
    const p = createPlayer(8 * 32, 200);
    ticks(p, ROOM, 60);
    expect(p.onGround).toBe(true);
    expect(p.y + PHYSICS.halfHeight).toBe(FLOOR_Y);
    expect(p.vy).toBe(0);
  });

  it('เดินชนกำแพงแล้วหยุด ไม่ทะลุ', () => {
    const p = standingPlayer(8 * 32);
    ticks(p, ROOM, 120, { right: true });
    expect(p.x + PHYSICS.halfWidth).toBe(11 * 32);
  });

  it('กดกระโดดค้าง สูงประมาณ 3.6 tile แล้วกลับลงพื้น', () => {
    const p = standingPlayer(9 * 32);
    const startY = p.y;
    let minY = p.y;
    for (let i = 0; i < 40; i++) {
      tick(p, ROOM, { jump: true });
      minY = Math.min(minY, p.y);
    }
    const rise = startY - minY;
    expect(rise).toBeGreaterThan(105);
    expect(rise).toBeLessThan(120);
    expect(p.onGround).toBe(true);
  });

  it('แตะปุ่มกระโดดสั้นๆ กระโดดเตี้ยกว่ากดค้าง', () => {
    const p = standingPlayer(9 * 32);
    const startY = p.y;
    let minY = p.y;
    tick(p, ROOM, { jump: true });
    for (let i = 0; i < 40; i++) {
      tick(p, ROOM);
      minY = Math.min(minY, p.y);
    }
    expect(startY - minY).toBeLessThan(60);
  });

  it('หัวชนเพดานแล้วตกลง ไม่ทะลุ', () => {
    const p = createPlayer(2 * 32 + 16, LEDGE_Y);
    ticks(p, ROOM, 3);
    let minTop = Infinity;
    for (let i = 0; i < 20; i++) {
      tick(p, ROOM, { jump: true });
      minTop = Math.min(minTop, p.y - PHYSICS.halfHeight);
    }
    // ชนเพดานกลาง tick แล้วรอบย่อยถัดไปเริ่มตกลงเล็กน้อย จึงเช็กเป็นช่วง
    expect(minTop).toBeGreaterThanOrEqual(32);
    expect(minTop).toBeLessThan(34);
  });
});

describe('coyote time และ jump buffer', () => {
  /** เดินขวาจนตกขอบหิ้ง แล้วรออีก waitTicks ก่อนกดกระโดด คืนค่า vy หลังกด */
  function jumpAfterLeavingLedge(waitTicks: number): number {
    const p = createPlayer(2 * 32 + 16, LEDGE_Y);
    ticks(p, ROOM, 3);
    for (let i = 0; i < 60 && p.onGround; i++) tick(p, ROOM, { right: true });
    expect(p.onGround).toBe(false);
    ticks(p, ROOM, waitTicks, { right: true });
    tick(p, ROOM, { right: true, jump: true });
    return p.vy;
  }

  it('เพิ่งเดินตกขอบ ยังกระโดดได้', () => {
    expect(jumpAfterLeavingLedge(1)).toBeLessThan(0);
  });

  it('ตกขอบนานแล้ว กระโดดกลางอากาศไม่ได้', () => {
    expect(jumpAfterLeavingLedge(6)).toBeGreaterThan(0);
  });

  /** ปล่อยผู้เล่นตกจากที่สูง แล้วเริ่มกดกระโดดค้างก่อนแตะพื้น pressEarly tick คืนว่าได้กระโดดไหม */
  function jumpPressedBeforeLanding(pressEarly: number): boolean {
    const probe = createPlayer(9 * 32, 150);
    let landTick = 0;
    while (!probe.onGround) {
      tick(probe, ROOM);
      landTick++;
    }
    const p = createPlayer(9 * 32, 150);
    ticks(p, ROOM, landTick - pressEarly);
    // ก่อนลงพื้นตัวละครมีแต่ตก (vy > 0) ถ้าเห็น vy < 0 แปลว่ากระโดดแล้ว
    let jumped = false;
    for (let i = 0; i < pressEarly + 4; i++) {
      tick(p, ROOM, { jump: true });
      if (p.vy < 0) jumped = true;
    }
    return jumped;
  }

  it('กดกระโดดก่อนแตะพื้นเล็กน้อย กระโดดทันทีที่ลงพื้น', () => {
    expect(jumpPressedBeforeLanding(2)).toBe(true);
  });

  it('กดกระโดดเร็วเกินไปก่อนแตะพื้น ไม่นับ', () => {
    expect(jumpPressedBeforeLanding(8)).toBe(false);
  });
});

describe('ปืน', () => {
  it('ไรเฟิลกดค้างยิง 10 นัดต่อวินาที', () => {
    const p = standingPlayer(6 * 32);
    p.weapon = 'rifle';
    expect(ticks(p, ROOM, TICK_RATE, { fire: true })).toHaveLength(10);
  });

  it('ปืนพกกดค้างยิงนัดเดียว ต้องปล่อยแล้วกดใหม่', () => {
    const p = standingPlayer(6 * 32);
    expect(ticks(p, ROOM, TICK_RATE, { fire: true })).toHaveLength(1);
    const q = standingPlayer(6 * 32);
    let shots = 0;
    for (let i = 0; i < TICK_RATE; i++) if (tick(q, ROOM, { fire: i % 2 === 0 })) shots++;
    expect(shots).toBeGreaterThanOrEqual(3);
  });

  it('ลูกซองยิง 5 เม็ด มุมคงที่รอบมุมเล็ง', () => {
    const p = standingPlayer(6 * 32);
    p.weapon = 'shotgun';
    const shot = tick(p, ROOM, { fire: true, aim: 0.5 });
    expect(shot?.angles).toEqual(WEAPONS.shotgun.spread.map((offset) => 0.5 + offset));
  });

  it('เพิ่งสลับปืน ยิงไม่ได้ทันที', () => {
    const p = standingPlayer(6 * 32);
    expect(tick(p, ROOM, { weapon: 'rifle', fire: true })).toBeNull();
  });

  it('กระสุนหยุดที่กำแพง', () => {
    expect(traceRay(ROOM, 176, 240, 0, 1000)).toBeCloseTo(11 * 32 - 176);
    expect(traceRay(ROOM, 176, 240, Math.PI, 1000)).toBeCloseTo(176 - 32);
    expect(traceRay(ROOM, 176, 240, Math.PI / 2, 1000)).toBeCloseTo(FLOOR_Y - 240);
    expect(traceRay(ROOM, 176, 240, 0, 50)).toBe(50);
  });

  it('resolveShot โดนเป้าที่อยู่ก่อนกำแพง และไม่โดนเป้าที่อยู่หลังกำแพง', () => {
    const front = { x: 300, y: 240, halfWidth: 12, halfHeight: 22 };
    const behind = { x: 400, y: 240, halfWidth: 12, halfHeight: 22 };
    const hit = resolveShot(ROOM, 176, 240, 0, 1000, [behind, front]);
    expect(hit.target).toBe(1);
    expect(hit.dist).toBeCloseTo(300 - 12 - 176);
    const miss = resolveShot(ROOM, 176, 240, 0, 1000, [behind]);
    expect(miss.target).toBe(-1);
    expect(miss.dist).toBeCloseTo(11 * 32 - 176);
  });
});

describe('determinism', () => {
  /** input ที่สร้างจากเลข tick อย่างเดียว ไม่มีการสุ่ม */
  function scriptedInput(i: number): PlayerInput {
    return {
      left: i % 90 < 30,
      right: i % 90 >= 50,
      jump: i % 37 < 5,
      fire: i % 11 < 3,
      aim: ((i * 0.07) % (2 * Math.PI)) - Math.PI,
      weapon: WEAPON_SLOTS[Math.floor(i / 120) % WEAPON_SLOTS.length] ?? 'pistol',
    };
  }

  function play(): { states: PlayerState[]; shots: ShotEvent[] } {
    const spawn = ARENA.playerSpawns[0] ?? { x: 0, y: 0 };
    const p = createPlayer(spawn.x, spawn.y);
    const states: PlayerState[] = [];
    const shots: ShotEvent[] = [];
    for (let i = 0; i < 600; i++) {
      const shot = stepPlayer(p, scriptedInput(i), ARENA, CTX);
      if (shot) shots.push(shot);
      states.push({ ...p });
    }
    return { states, shots };
  }

  it('input ชุดเดิมรัน 2 รอบ ได้ state และการยิงเท่ากันทุก tick', () => {
    const a = play();
    const b = play();
    expect(a.states).toEqual(b.states);
    expect(a.shots).toEqual(b.shots);
    expect(a.shots.length).toBeGreaterThan(10);
  });
});
