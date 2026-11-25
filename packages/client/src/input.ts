import Phaser from 'phaser';
import { WEAPON_SLOTS, type PlayerInput, type WeaponId } from '@armor/shared';

/**
 * อ่านคีย์บอร์ดกับเมาส์ แล้วสรุปเป็น PlayerInput 1 ชุดต่อ tick
 * จอวาดเร็วกว่า tick (60–144 FPS เทียบกับ 30 tick) ถ้ากดแล้วปล่อยระหว่าง tick
 * ปุ่มนั้นจะหายไป จึงพักค่า "เคยกด" ไว้ (input latch) จนกว่าจะส่งใน tick ถัดไป
 */
export class InputSampler {
  private readonly left: Phaser.Input.Keyboard.Key[];
  private readonly right: Phaser.Input.Keyboard.Key[];
  private readonly jump: Phaser.Input.Keyboard.Key[];
  private readonly pointer: Phaser.Input.Pointer;
  private jumpLatched = false;
  private fireLatched = false;
  private weapon: WeaponId = 'pistol';

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('ไม่พบคีย์บอร์ด');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.left = [keyboard.addKey(K.A), keyboard.addKey(K.LEFT)];
    this.right = [keyboard.addKey(K.D), keyboard.addKey(K.RIGHT)];
    this.jump = [keyboard.addKey(K.W), keyboard.addKey(K.UP), keyboard.addKey(K.SPACE)];
    for (const key of this.jump) {
      key.on('down', () => {
        this.jumpLatched = true;
      });
    }
    WEAPON_SLOTS.forEach((id, i) => {
      keyboard.addKey(K.ONE + i).on('down', () => {
        this.weapon = id;
      });
    });

    this.pointer = scene.input.activePointer;
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.fireLatched = true;
    });
    scene.input.mouse?.disableContextMenu();
  }

  get selectedWeapon(): WeaponId {
    return this.weapon;
  }

  /** เรียก 1 ครั้งต่อ tick เท่านั้น เพราะจะล้างค่าที่พักไว้ */
  sample(aim: number): PlayerInput {
    const input: PlayerInput = {
      left: this.left.some((key) => key.isDown),
      right: this.right.some((key) => key.isDown),
      jump: this.jumpLatched || this.jump.some((key) => key.isDown),
      fire: this.fireLatched || this.pointer.leftButtonDown(),
      aim,
      weapon: this.weapon,
    };
    this.jumpLatched = false;
    this.fireLatched = false;
    return input;
  }
}
