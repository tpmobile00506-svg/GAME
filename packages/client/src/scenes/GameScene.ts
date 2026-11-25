import Phaser from 'phaser';
import {
  ARENA,
  ARENA_TILED,
  PHYSICS,
  WEAPONS,
  WEAPON_SLOTS,
  isSolid,
  resolveShot,
  stepPlayer,
  weaponOf,
  type Box,
  type PlayerEntity,
  type PlayerState,
  type ShotEvent,
} from '@armor/shared';
import { InputSampler } from '../input.ts';
import { SERVER_URL, connectToGame, type NetSession } from '../net.ts';
import { setStatus } from '../status.ts';

const GUN_LENGTH = 26;

const COLOR = {
  me: 0x4fa3d9,
  meEdge: 0x1d4a66,
  other: 0xe0a040,
  otherEdge: 0x6b4a12,
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

interface PlayerView {
  readonly entity: PlayerEntity;
  readonly isMe: boolean;
  readonly container: Phaser.GameObjects.Container;
  readonly gun: Phaser.GameObjects.Rectangle;
  readonly visor: Phaser.GameObjects.Rectangle;
}

interface DebugShot {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * ฉากเกมออนไลน์ (เฟส 2)
 * ลำดับในแต่ละเฟรม (ตามกติกาของ Colyseus): predict.tick() → ส่ง input เท่าจำนวน step ที่ถึงเวลา → อ่านค่ามาวาด
 * ตัวเราทำนายทันทีด้วย stepPlayer ตัวเดียวกับเซิร์ฟเวอร์ (reconciler) คนอื่นแสดงย้อนหลังเล็กน้อยให้ลื่น (lerp)
 */
export class GameScene extends Phaser.Scene {
  private net: NetSession | null = null;
  /** state ของตัวเราที่ทำนายไว้ (ค่าจริงสำหรับตรรกะเกม ไม่มีการทำให้ลื่น) null = ยังไม่ได้เข้าห้อง */
  private myState: (() => PlayerState) | null = null;
  private readonly views = new Map<string, PlayerView>();
  private inputs!: InputSampler;
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
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    for (const spawn of ARENA.dummySpawns) {
      const box: Box = { x: spawn.x, y: spawn.y - PHYSICS.halfHeight, halfWidth: 12, halfHeight: PHYSICS.halfHeight };
      const view = this.add
        .rectangle(box.x, box.y, box.halfWidth * 2, box.halfHeight * 2, COLOR.dummy)
        .setStrokeStyle(2, COLOR.dummyEdge);
      this.dummies.push({ box, view });
    }

    this.debug = this.add.graphics().setDepth(10);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.H).on('down', () => {
      this.debugOn = !this.debugOn;
    });
    this.hud = this.add
      .text(12, 10, '', { fontFamily: 'monospace', fontSize: '16px', color: '#e8e8e8' })
      .setScrollFactor(0)
      .setDepth(20);
    this.inputs = new InputSampler(this);

    void this.connect();
  }

  private async connect(): Promise<void> {
    setStatus(`กำลังต่อเซิร์ฟเวอร์ ${SERVER_URL} …`);
    let net: NetSession;
    try {
      net = await connectToGame();
    } catch (error) {
      console.error(error);
      setStatus(`ต่อเซิร์ฟเวอร์ไม่ได้ (${SERVER_URL}) เปิดเซิร์ฟเวอร์ด้วย pnpm dev:server แล้วรีเฟรชหน้านี้`);
      return;
    }
    this.net = net;
    setStatus(null);

    const { room, input, predict, callbacks } = net;
    // ชนิดของพารามิเตอร์ใน callback นี้ TypeScript อนุมานไม่ได้ (ได้ unknown) จึงอ่านผู้เล่นจาก room.state ที่มีชนิดชัดเจนแทน
    callbacks.onAdd('players', (_entity, key) => {
      const sessionId = String(key);
      const entity = room.state.players.get(sessionId);
      if (!entity) return;
      const isMe = sessionId === room.sessionId;
      this.addView(sessionId, entity, isMe);
      if (!isMe) return;
      const me = predict.reconciler(entity, {
        input,
        step: (ctx, state, cmd) => {
          const shot = stepPlayer(state, cmd, ARENA, ctx);
          // เอฟเฟกต์เล่นเฉพาะ step จริง ไม่เล่นซ้ำตอนคำนวณย้อนเพื่อแก้ตำแหน่ง
          if (shot && !ctx.isReplay) this.showShot(shot);
        },
        smoothMs: 65,
        warnOnDivergence: 1,
      });
      this.myState = () => me.state;
    });
    callbacks.onRemove('players', (_entity, key) => this.removeView(String(key)));
    // เน็ตหลุดชั่วคราว: SDK พยายามต่อใหม่เอง ถ้าไม่สำเร็จจะเป็น onLeave แล้วหยุดส่ง input ทั้งหมด
    room.onDrop(() => setStatus('เน็ตหลุด กำลังต่อใหม่…'));
    room.onReconnect(() => setStatus(null));
    room.onLeave((code) => {
      this.net = null;
      this.myState = null;
      setStatus(`หลุดจากเซิร์ฟเวอร์ (code ${code}) รีเฟรชหน้านี้เพื่อเข้าใหม่`);
    });
  }

  update(): void {
    const net = this.net;
    // ยังไม่ได้เข้าห้อง หรือยังไม่ได้สร้างตัวทำนายของตัวเอง: ยังไม่ส่ง input ไม่งั้นเซิร์ฟเวอร์จะได้ input ที่ client ไม่ได้บันทึกไว้
    if (!net || !this.myState) return;

    // 1) ถึงเวลากี่ fixed step แล้ว 2) ส่ง input ทีละ step 3) ค่อยอ่านค่ามาวาด
    const steps = net.predict.tick();
    for (let i = 0; i < steps; i++) {
      Object.assign(net.input.data, this.inputs.sample(this.aimAngle()));
      net.input.send();
    }

    const myAim = this.aimAngle();
    for (const view of this.views.values()) {
      view.container.setPosition(net.predict.value(view.entity, 'x'), net.predict.value(view.entity, 'y'));
      const aim = view.isMe ? myAim : net.predict.value(view.entity, 'aim');
      view.gun.setRotation(aim);
      view.visor.x = Math.cos(aim) >= 0 ? 3 : -3;
    }

    this.updateHud(net);
    this.drawDebug();
  }

  /**
   * มุมจากไหล่ไปหาเมาส์ในพิกัดโลก
   * - วัดจาก state ที่ทำนายไว้ (จุดเดียวกับที่กระสุนออก) ไม่ใช่ตำแหน่งภาพที่ถูกทำให้ลื่น
   * - คิดจาก scroll ของกล้องเอง ไม่ใช้ getWorldPoint เพราะจะติดแรงจอสั่นมาด้วย (กล้องเกมนี้ไม่ซูม)
   */
  private aimAngle(): number {
    if (!this.myState) return 0;
    const state = this.myState();
    const pointer = this.input.activePointer;
    const camera = this.cameras.main;
    const worldX = camera.scrollX + pointer.x;
    const worldY = camera.scrollY + pointer.y;
    return Math.atan2(worldY - (state.y + PHYSICS.shoulderY), worldX - state.x);
  }

  private addView(sessionId: string, entity: PlayerEntity, isMe: boolean): void {
    const body = this.add
      .rectangle(0, 0, PHYSICS.halfWidth * 2, PHYSICS.halfHeight * 2, isMe ? COLOR.me : COLOR.other)
      .setStrokeStyle(2, isMe ? COLOR.meEdge : COLOR.otherEdge);
    const visor = this.add.rectangle(3, -12, 14, 6, COLOR.visor);
    const gun = this.add.rectangle(0, PHYSICS.shoulderY, GUN_LENGTH, 6, COLOR.gun).setOrigin(0, 0.5);
    const container = this.add.container(entity.x, entity.y, [body, visor, gun]).setDepth(isMe ? 4 : 3);
    this.views.set(sessionId, { entity, isMe, container, gun, visor });
    if (isMe) this.cameras.main.startFollow(container, true, 0.15, 0.15);
  }

  private removeView(sessionId: string): void {
    this.views.get(sessionId)?.container.destroy();
    this.views.delete(sessionId);
  }

  /** เฟส 2 ยิงได้แค่เป้าซ้อมในเครื่องตัวเอง เฟส 3 เซิร์ฟเวอร์จะตัดสินการยิงโดนผู้เล่นด้วย resolveShot */
  private showShot(shot: ShotEvent): void {
    const weapon = WEAPONS[shot.weapon];
    const boxes = this.dummies.map((dummy) => dummy.box);
    shot.angles.forEach((angle, pellet) => {
      const hit = resolveShot(ARENA, shot.x, shot.y, angle, weapon.range, boxes);
      const muzzle = Math.min(GUN_LENGTH, hit.dist);
      this.tracer(shot.x + Math.cos(angle) * muzzle, shot.y + Math.sin(angle) * muzzle, hit.endX, hit.endY);
      this.debugShots.push({ x1: shot.x, y1: shot.y, x2: hit.endX, y2: hit.endY });

      const dummy = this.dummies[hit.target];
      const labelOffset = (pellet - (shot.angles.length - 1) / 2) * 6;
      if (dummy) this.hitDummy(dummy, weapon.damage, hit.endX + labelOffset, hit.endY);
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

  private hitDummy(dummy: Dummy, damage: number, x: number, y: number): void {
    dummy.view.setFillStyle(0xffffff);
    this.time.delayedCall(60, () => dummy.view.setFillStyle(COLOR.dummy));

    const label = this.add
      .text(x, y - 10, String(damage), {
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

  private updateHud(net: NetSession): void {
    const current = this.myState ? weaponOf(this.myState()) : 'pistol';
    const slots = WEAPON_SLOTS.map((id, i) => {
      const name = `${i + 1} ${WEAPONS[id].label}`;
      return id === current ? `[${name}]` : ` ${name} `;
    }).join(' ');
    const ping = Math.round(net.room.clock.rtt());
    this.hud.setText(
      `${slots}\nping ${ping} ms · players ${net.room.state.players.size} · room ${net.room.roomId}\nH: hitbox ${this.debugOn ? 'ON' : 'off'}`,
    );
  }

  /**
   * โหมด debug (กด H):
   * - เขียว = tile ที่ชนได้ · เหลือง = เป้าซ้อม · แดง = เส้นกระสุนล่าสุด
   * - ม่วง = ตัวเราที่ทำนายไว้ · ฟ้า = ตำแหน่งจริงล่าสุดจากเซิร์ฟเวอร์ (ทุกคน)
   * ถ้าม่วงกับฟ้าห่างกันตลอดเวลาแม้ยืนนิ่ง แปลว่าฟิสิกส์สองฝั่งไม่ตรงกัน
   */
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

    const w = PHYSICS.halfWidth * 2;
    const h = PHYSICS.halfHeight * 2;
    g.lineStyle(1, 0x40c8ff, 1);
    for (const view of this.views.values()) {
      g.strokeRect(view.entity.x - PHYSICS.halfWidth, view.entity.y - PHYSICS.halfHeight, w, h);
    }
    if (this.myState) {
      const me = this.myState();
      g.lineStyle(2, 0xff00ff, 1);
      g.strokeRect(me.x - PHYSICS.halfWidth, me.y - PHYSICS.halfHeight, w, h);
    }

    g.lineStyle(1, 0xff4040, 0.8);
    for (const s of this.debugShots) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  }
}
