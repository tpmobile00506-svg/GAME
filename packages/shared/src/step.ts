// ฟิสิกส์และการชนทั้งหมดของเกม (ไฟล์เดียว ตามกฎใน docs/rules.md)
// client ใช้ทำนายตัวเอง เซิร์ฟเวอร์ใช้ตัดสินผลจริง สองฝั่งต้องได้ผลเท่ากันทุกครั้ง
// ห้ามใช้ Math.random() หรือ Date.now() ในไฟล์นี้: ทุกอย่างต้องมาจาก state, input และ ctx
import { isSolid, type GameMap } from './map.ts';
import type { PlayerInput } from './messages.ts';
import { WEAPONS, WEAPON_SLOTS, WEAPON_SWITCH_TIME, type WeaponId } from './weapons.ts';

/** ค่าฟิสิกส์ทั้งหมด หน่วยเป็นพิกเซลและวินาที */
export const PHYSICS = {
  /**
   * แบ่งคำนวณกี่รอบย่อยต่อ 1 tick ยิ่งมากยิ่งไม่ทะลุพื้น (2 รอบที่ 30 tick = ละเอียดเท่า 60 Hz)
   * เซิร์ฟเวอร์ใช้ค่านี้ตั้ง setFixedTimestep(..., { subSteps }) แล้ว Colyseus ส่งต่อให้ client เอง
   * ใน stepPlayer ห้ามอ่านค่านี้ตรงๆ ให้อ่าน ctx.subSteps / ctx.subDt
   */
  substeps: 2,
  gravity: 1800,
  maxFallSpeed: 900,
  runSpeed: 260,
  groundAccel: 2600,
  airAccel: 1500,
  jumpSpeed: 650,
  /** ปล่อยปุ่มกระโดดตอนกำลังขึ้น ความเร็วจะถูกตัดเหลือเท่านี้ (กระโดดเบา/แรงได้) */
  jumpCutSpeed: 260,
  /** ยังกระโดดได้อีกนิดหลังเดินตกขอบ */
  coyoteTime: 0.1,
  /** กดกระโดดก่อนถึงพื้นนิดหน่อยก็ยังนับ */
  jumpBufferTime: 0.12,
  /** ครึ่งหนึ่งของกล่องชนผู้เล่น (กล่องจริง 22 × 44) */
  halfWidth: 11,
  halfHeight: 22,
  /** ไหล่อยู่สูงกว่ากึ่งกลางตัวเท่านี้ กระสุนออกจากจุดนี้ */
  shoulderY: -8,
} as const;

/** state ของผู้เล่น 1 คน ทุกค่าที่ step ใช้ตัดสินใจต้องอยู่ในนี้ */
export interface PlayerState {
  /** จุดกึ่งกลางกล่องชน */
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  /** เวลาที่เหลือของ coyote time */
  coyote: number;
  /** เวลาที่เหลือของ jump buffer */
  jumpBuffer: number;
  /** ปืนที่ถืออยู่ เป็นลำดับใน WEAPON_SLOTS (เก็บเป็นตัวเลข เพราะ prediction ของ Colyseus เทียบตัวเลขได้แม่นกว่าข้อความ) */
  weapon: number;
  /** เวลาที่เหลือก่อนยิงนัดถัดไปได้ */
  cooldown: number;
  aim: number;
}

/** ข้อมูลเวลาของ 1 tick ฝั่งเซิร์ฟเวอร์ได้จาก setFixedTimestep ฝั่ง client ได้จาก reconciler ของ Colyseus */
export interface StepContext {
  /** เวลาของ 1 tick เป็นวินาที */
  readonly dt: number;
  /** จำนวนรอบย่อยของฟิสิกส์ต่อ 1 tick */
  readonly subSteps: number;
  /** เวลาของ 1 รอบย่อยเป็นวินาที (dt / subSteps) */
  readonly subDt: number;
  /** true = กำลังคำนวณซ้ำเพื่อแก้ตำแหน่งตามเซิร์ฟเวอร์ ห้ามเล่นเสียงหรือเอฟเฟกต์ */
  readonly isReplay: boolean;
}

/** ชื่อปืนที่ผู้เล่นถืออยู่ */
export function weaponOf(p: PlayerState): WeaponId {
  return WEAPON_SLOTS[p.weapon] ?? 'pistol';
}

/** ผลของการยิง 1 ครั้ง: ยิงจากไหน กี่เม็ด มุมอะไร (ยังไม่รู้ว่าโดนอะไร ต้องเรียก resolveShot ต่อ) */
export interface ShotEvent {
  readonly weapon: WeaponId;
  readonly x: number;
  readonly y: number;
  readonly angles: readonly number[];
}

/** กล่องชน อ้างอิงจากจุดกึ่งกลาง */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

/** กันปัญหาทศนิยมตอนขอบกล่องแตะขอบ tile พอดี */
const EPS = 1e-6;

/** สร้างผู้เล่นใหม่ โดย (x, feetY) คือตำแหน่งเท้า ตรงกับจุดเกิดใน Tiled */
export function createPlayer(x: number, feetY: number): PlayerState {
  return {
    x,
    y: feetY - PHYSICS.halfHeight,
    vx: 0,
    vy: 0,
    onGround: false,
    coyote: 0,
    jumpBuffer: 0,
    weapon: 0,
    cooldown: 0,
    aim: 0,
  };
}

export function playerBox(p: PlayerState): Box {
  return { x: p.x, y: p.y, halfWidth: PHYSICS.halfWidth, halfHeight: PHYSICS.halfHeight };
}

/** ขยับ value เข้าหา target ไม่เกิน maxDelta */
function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

/** ขยับแนวนอนแล้วดันออกจาก tile ที่ชน (ระยะต่อรอบย่อยต้องน้อยกว่า 1 tile) */
function moveX(p: PlayerState, dx: number, map: GameMap): void {
  if (dx === 0) return;
  p.x += dx;
  const t = map.tileSize;
  const top = Math.floor((p.y - PHYSICS.halfHeight) / t);
  const bottom = Math.floor((p.y + PHYSICS.halfHeight - EPS) / t);
  const col = dx > 0 ? Math.floor((p.x + PHYSICS.halfWidth - EPS) / t) : Math.floor((p.x - PHYSICS.halfWidth) / t);
  for (let row = top; row <= bottom; row++) {
    if (isSolid(map, col, row)) {
      p.x = dx > 0 ? col * t - PHYSICS.halfWidth : (col + 1) * t + PHYSICS.halfWidth;
      p.vx = 0;
      return;
    }
  }
}

/** ขยับแนวตั้งแล้วดันออกจาก tile ที่ชน และบอกว่ายืนบนพื้นหรือเปล่า */
function moveY(p: PlayerState, dy: number, map: GameMap): void {
  p.onGround = false;
  if (dy === 0) return;
  p.y += dy;
  const t = map.tileSize;
  const left = Math.floor((p.x - PHYSICS.halfWidth) / t);
  const right = Math.floor((p.x + PHYSICS.halfWidth - EPS) / t);
  const row = dy > 0 ? Math.floor((p.y + PHYSICS.halfHeight - EPS) / t) : Math.floor((p.y - PHYSICS.halfHeight) / t);
  for (let col = left; col <= right; col++) {
    if (isSolid(map, col, row)) {
      if (dy > 0) {
        p.y = row * t - PHYSICS.halfHeight;
        p.onGround = true;
      } else {
        p.y = (row + 1) * t + PHYSICS.halfHeight;
      }
      p.vy = 0;
      return;
    }
  }
}

/**
 * เดินเกม 1 tick ให้ผู้เล่น 1 คน (แก้ค่าใน p โดยตรง)
 * คืนค่า ShotEvent ถ้า tick นี้ยิงออกไป ไม่งั้นคืน null
 */
export function stepPlayer(p: PlayerState, input: PlayerInput, map: GameMap, ctx: StepContext): ShotEvent | null {
  p.cooldown = Math.max(0, p.cooldown - ctx.dt);

  // input ที่ผิดรูปแบบ (มุมไม่ใช่ตัวเลขจริง ปืนไม่มีในรายการ) ไม่เอามาใช้ กันเกมค้างหรือพัง
  if (Number.isFinite(input.aim)) p.aim = input.aim;
  const slot = input.switchTo;
  if (Number.isInteger(slot) && slot >= 0 && slot < WEAPON_SLOTS.length && slot !== p.weapon) {
    p.weapon = slot;
    p.cooldown = Math.max(p.cooldown, WEAPON_SWITCH_TIME);
  }

  // จำว่าเพิ่งกดกระโดด แล้วค่อยใช้ตอนแตะพื้น (jump buffer)
  if (input.jumpPressed) p.jumpBuffer = PHYSICS.jumpBufferTime;

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const h = ctx.subDt;
  for (let i = 0; i < ctx.subSteps; i++) {
    const accel = p.onGround ? PHYSICS.groundAccel : PHYSICS.airAccel;
    p.vx = approach(p.vx, dir * PHYSICS.runSpeed, accel * h);

    p.coyote = p.onGround ? PHYSICS.coyoteTime : Math.max(0, p.coyote - h);
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -PHYSICS.jumpSpeed;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
    }
    p.jumpBuffer = Math.max(0, p.jumpBuffer - h);
    if (!input.jump && p.vy < -PHYSICS.jumpCutSpeed) p.vy = -PHYSICS.jumpCutSpeed;

    p.vy = Math.min(p.vy + PHYSICS.gravity * h, PHYSICS.maxFallSpeed);
    moveX(p, p.vx * h, map);
    moveY(p, p.vy * h, map);
  }

  // ปืน: step ดูแลแค่คูลดาวน์กับการตัดสินว่ายิงออกไปไหม ส่วนโดนอะไรใช้ resolveShot
  const weaponId = weaponOf(p);
  const weapon = WEAPONS[weaponId];
  const pulledTrigger = weapon.automatic ? input.fire : input.firePressed;
  if (!pulledTrigger || p.cooldown > EPS) return null;
  p.cooldown = weapon.fireInterval;
  return {
    weapon: weaponId,
    x: p.x,
    y: p.y + PHYSICS.shoulderY,
    angles: weapon.spread.map((offset) => p.aim + offset),
  };
}

/** ยิงเส้นตรงจาก (x, y) ตามมุม angle คืนระยะถึง tile แรกที่ชน (ไม่เกิน maxDist) */
export function traceRay(map: GameMap, x: number, y: number, angle: number, maxDist: number): number {
  // ค่า NaN หรือ Infinity จะทำให้ลูปด้านล่างไม่มีวันจบ เซิร์ฟเวอร์ค้างทั้งห้อง
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(angle) || !Number.isFinite(maxDist)) return 0;
  const t = map.tileSize;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let tx = Math.floor(x / t);
  let ty = Math.floor(y / t);
  if (isSolid(map, tx, ty)) return 0;

  // เดินทีละช่องตาราง (DDA) จนเจอ tile ที่ชนได้
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const deltaX = dx !== 0 ? Math.abs(t / dx) : Infinity;
  const deltaY = dy !== 0 ? Math.abs(t / dy) : Infinity;
  let nextX = dx > 0 ? ((tx + 1) * t - x) / dx : dx < 0 ? (tx * t - x) / dx : Infinity;
  let nextY = dy > 0 ? ((ty + 1) * t - y) / dy : dy < 0 ? (ty * t - y) / dy : Infinity;

  // นอกขอบแมพนับเป็น tile ชนได้ จึงเดินไม่เกิน width + height ช่องก็ต้องชนแน่นอน
  for (let steps = 0; steps <= map.width + map.height + 2; steps++) {
    let dist: number;
    if (nextX < nextY) {
      dist = nextX;
      nextX += deltaX;
      tx += stepX;
    } else {
      dist = nextY;
      nextY += deltaY;
      ty += stepY;
    }
    if (dist >= maxDist) return maxDist;
    if (isSolid(map, tx, ty)) return dist;
  }
  return 0;
}

/** ระยะที่เส้นจาก (x, y) ทิศ (dx, dy) ชนกล่อง หรือ null ถ้าไม่ชนภายใน maxDist */
export function rayVsBox(x: number, y: number, dx: number, dy: number, box: Box, maxDist: number): number | null {
  if (![x, y, dx, dy, maxDist].every(Number.isFinite)) return null;
  let near = 0;
  let far = maxDist;
  const axes: readonly [number, number, number, number][] = [
    [x, dx, box.x - box.halfWidth, box.x + box.halfWidth],
    [y, dy, box.y - box.halfHeight, box.y + box.halfHeight],
  ];
  for (const [origin, dir, min, max] of axes) {
    if (dir === 0) {
      if (origin < min || origin > max) return null;
      continue;
    }
    let t1 = (min - origin) / dir;
    let t2 = (max - origin) / dir;
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return null;
  }
  return near;
}

export interface ShotResult {
  /** ระยะที่กระสุนไปถึง */
  readonly dist: number;
  /** index ของเป้าที่โดน หรือ -1 ถ้าโดนกำแพงหรือไม่โดนอะไร */
  readonly target: number;
  readonly endX: number;
  readonly endY: number;
}

/**
 * หาว่ากระสุน 1 เม็ดโดนอะไรก่อน ระหว่างกำแพงกับเป้าใน targets
 * เฟส 3: เซิร์ฟเวอร์จะเรียกฟังก์ชันนี้โดยส่งกล่องของผู้เล่นที่ย้อนเวลาแล้ว
 */
export function resolveShot(map: GameMap, x: number, y: number, angle: number, range: number, targets: readonly Box[]): ShotResult {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let dist = traceRay(map, x, y, angle, range);
  let target = -1;
  targets.forEach((box, i) => {
    const hit = rayVsBox(x, y, dx, dy, box, dist);
    if (hit !== null && hit < dist) {
      dist = hit;
      target = i;
    }
  });
  return { dist, target, endX: x + dx * dist, endY: y + dy * dist };
}
