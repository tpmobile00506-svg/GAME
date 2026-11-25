import Phaser from 'phaser';
import {
  ARENA,
  ARENA_TILED,
  PHYSICS,
  TICK_RATE,
  WEAPONS,
  WEAPON_SLOTS,
  createPlayer,
  isSolid,
  resolveShot,
  stepPlayer,
  type Box,
  type PlayerState,
  type ShotEvent,
} from '@armor/shared';
import { InputSampler } from '../input.ts';

const DT = 1 / TICK_RATE;
/** สลับแท็บแล้วกลับมา จะไม่ไล่คำนวณย้อนหลังเกินนี้ต่อเฟรม เกมจะได้ไม่เร่งเอง */
const MAX_STEPS_PER_FRAME = 5;
const GUN_LENGTH = 26;

const COLOR = {
  body: 0x4fa3d9,
  bodyEdge: 0x1d4a66,
  visor: 0xd8f0ff,
  gun: 0x1b1f27,
  dummy: 0xb84a4a,
  dummyEdge: 0x5a1e1e,
  tracer: 0xfff3b0,
  spark: 0xffc857,
};

interface Dummy {
  readonly box: Box;
  readonly view: Phaser.GameObjects.Rectangle;
}

interface DebugShot {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * demo เฟส 1: เล่นคนเดียวบนแมพ arena
 * เกมเดินเป็น tick คงที่ (TICK_RATE) ด้วย stepPlayer จาก shared ส่วนภาพวาดแบบ lerp ระหว่าง tick ให้ลื่น
 */
export class GameScene extends Phaser.Scene {
  private player!: PlayerState;
  private prevX = 0;
  private prevY = 0;
  private accumulator = 0;
  private inputs!: InputSampler;
  private playerView!: Phaser.GameObjects.Container;
  private gun!: Phaser.GameObjects.Rectangle;
  private visor!: Phaser.GameObjects.Rectangle;
  private dummies: Dummy[] = [];
  private debug!: Phaser.GameObjects.Graphics;
  private debugOn = false;
  private debugShots: DebugShot[] = [];
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super('game');
  }

  preload(): void {
    this.load.image('tiles', 'tiles/placeholder.png');
    this.load.tilemapTiledJSON('arena', ARENA_TILED);
  }

  create(): void {
    const map = this.make.tilemap({ key: 'arena' });
    const tileset = map.addTilesetImage('placeholder', 'tiles');
    if (!tileset) throw new Error('โหลด tileset "placeholder" ไม่ได้');
    map.createLayer('solid', tileset, 0, 0);

    for (const spawn of ARENA.dummySpawns) {
      const box: Box = { x: spawn.x, y: spawn.y - PHYSICS.halfHeight, halfWidth: 12, halfHeight: PHYSICS.halfHeight };
      const view = this.add
        .rectangle(box.x, box.y, box.halfWidth * 2, box.halfHeight * 2, COLOR.dummy)
        .setStrokeStyle(2, COLOR.dummyEdge);
      this.dummies.push({ box, view });
    }

    const spawn = ARENA.playerSpawns[0] ?? { x: 64, y: 64 };
    this.player = createPlayer(spawn.x, spawn.y);
    this.prevX = this.player.x;
    this.prevY = this.player.y;

    const body = this.add
      .rectangle(0, 0, PHYSICS.halfWidth * 2, PHYSICS.halfHeight * 2, COLOR.body)
      .setStrokeStyle(2, COLOR.bodyEdge);
    this.visor = this.add.rectangle(3, -12, 14, 6, COLOR.visor);
    this.gun = this.add.rectangle(0, PHYSICS.shoulderY, GUN_LENGTH, 6, COLOR.gun).setOrigin(0, 0.5);
    this.playerView = this.add.container(this.player.x, this.player.y, [body, this.visor, this.gun]);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    camera.startFollow(this.playerView, true, 0.15, 0.15);

    this.debug = this.add.graphics().setDepth(10);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.H).on('down', () => {
      this.debugOn = !this.debugOn;
    });

    this.hud = this.add
      .text(12, 10, '', { fontFamily: 'monospace', fontSize: '16px', color: '#e8e8e8' })
      .setScrollFactor(0)
      .setDepth(20);

    this.inputs = new InputSampler(this);
  }

  update(_time: number, deltaMs: number): void {
    this.accumulator += deltaMs / 1000;
    let steps = 0;
    while (this.accumulator >= DT && steps < MAX_STEPS_PER_FRAME) {
      this.prevX = this.player.x;
      this.prevY = this.player.y;
      const shot = stepPlayer(this.player, this.inputs.sample(this.aimAngle()), ARENA, { dt: DT, isReplay: false });
      if (shot) this.showShot(shot);
      this.accumulator -= DT;
      steps++;
    }
    if (this.accumulator >= DT) this.accumulator = 0;

    // วาดตัวละครระหว่างตำแหน่ง tick ก่อนกับ tick ล่าสุด ภาพจะลื่นแม้เกมเดินแค่ 30 tick
    const alpha = this.accumulator / DT;
    this.playerView.setPosition(
      Phaser.Math.Linear(this.prevX, this.player.x, alpha),
      Phaser.Math.Linear(this.prevY, this.player.y, alpha),
    );
    const aim = this.aimAngle();
    this.gun.setRotation(aim);
    this.visor.x = Math.cos(aim) >= 0 ? 3 : -3;

    this.updateHud();
    this.drawDebug();
  }

  /** มุมจากไหล่ไปหาเมาส์ ใช้พิกัดโลก (ผ่านกล้อง) ไม่ใช่พิกัดบนจอ */
  private aimAngle(): number {
    const pointer = this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return Math.atan2(world.y - (this.playerView.y + PHYSICS.shoulderY), world.x - this.playerView.x);
  }

  /** เอฟเฟกต์ฝั่ง client: ใน demo เล่นคนเดียวยังไม่มี replay พอต่อออนไลน์ต้องอยู่ใน if (!ctx.isReplay) */
  private showShot(shot: ShotEvent): void {
    const weapon = WEAPONS[shot.weapon];
    const boxes = this.dummies.map((dummy) => dummy.box);
    shot.angles.forEach((angle, pellet) => {
      const hit = resolveShot(ARENA, shot.x, shot.y, angle, weapon.range, boxes);
      const muzzle = Math.min(GUN_LENGTH, hit.dist);
      const x1 = shot.x + Math.cos(angle) * muzzle;
      const y1 = shot.y + Math.sin(angle) * muzzle;
      this.tracer(x1, y1, hit.endX, hit.endY);
      this.debugShots.push({ x1: shot.x, y1: shot.y, x2: hit.endX, y2: hit.endY });

      const dummy = this.dummies[hit.target];
      if (dummy) this.hitDummy(dummy, weapon.damage, hit.endX, hit.endY, pellet);
      else this.spark(hit.endX, hit.endY);
    });
    this.debugShots = this.debugShots.slice(-20);

    // จอสั่นตามแรงปืน (ดาเมจรวมทุกเม็ด)
    this.cameras.main.shake(60, 0.00012 * weapon.damage * shot.angles.length);
  }

  private tracer(x1: number, y1: number, x2: number, y2: number): void {
    const line = this.add.graphics().setDepth(5);
    line.lineStyle(2, COLOR.tracer, 1);
    line.lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: line, alpha: 0, duration: 90, onComplete: () => line.destroy() });
  }

  private spark(x: number, y: number): void {
    const dot = this.add.rectangle(x, y, 5, 5, COLOR.spark).setDepth(5);
    this.tweens.add({ targets: dot, alpha: 0, scale: 0.2, duration: 150, onComplete: () => dot.destroy() });
  }

  private hitDummy(dummy: Dummy, damage: number, x: number, y: number, pellet: number): void {
    dummy.view.setFillStyle(0xffffff);
    this.time.delayedCall(60, () => dummy.view.setFillStyle(COLOR.dummy));

    const label = this.add
      .text(x + (pellet - 2) * 6, y - 10, String(damage), {
        fontFamily: 'monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffe08a',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.tweens.add({ targets: label, y: label.y - 30, alpha: 0, duration: 600, onComplete: () => label.destroy() });
  }

  private updateHud(): void {
    const slots = WEAPON_SLOTS.map((id, i) => {
      const name = `${i + 1} ${WEAPONS[id].label}`;
      return id === this.player.weapon ? `[${name}]` : ` ${name} `;
    }).join(' ');
    this.hud.setText(`${slots}\nH: hitbox ${this.debugOn ? 'ON' : 'off'}`);
  }

  /** โหมด debug (กด H): กรอบชนของ tile ผู้เล่น เป้า และเส้นกระสุนล่าสุด จากค่าจริงใน state */
  private drawDebug(): void {
    const g = this.debug;
    g.clear();
    if (!this.debugOn) return;

    const t = ARENA.tileSize;
    g.lineStyle(1, 0x00ff88, 0.5);
    for (let ty = 0; ty < ARENA.height; ty++) {
      for (let tx = 0; tx < ARENA.width; tx++) {
        if (isSolid(ARENA, tx, ty)) g.strokeRect(tx * t, ty * t, t, t);
      }
    }

    g.lineStyle(1, 0xffe000, 1);
    for (const { box } of this.dummies) {
      g.strokeRect(box.x - box.halfWidth, box.y - box.halfHeight, box.halfWidth * 2, box.halfHeight * 2);
    }

    const p = this.player;
    g.lineStyle(2, 0xff00ff, 1);
    g.strokeRect(p.x - PHYSICS.halfWidth, p.y - PHYSICS.halfHeight, PHYSICS.halfWidth * 2, PHYSICS.halfHeight * 2);

    g.lineStyle(1, 0xff4040, 0.8);
    for (const s of this.debugShots) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  }
}
