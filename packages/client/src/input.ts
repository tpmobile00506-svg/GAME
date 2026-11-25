import Phaser from 'phaser';
import { NO_SWITCH, WEAPON_SLOTS, type PlayerInput } from '@armor/shared';

/**
 * อ่านคีย์บอร์ดกับเมาส์ แล้วสรุปเป็น PlayerInput 1 ชุดต่อ tick
 * จอวาดเร็วกว่า tick (60–144 FPS เทียบกับ 30 tick) จึงพักค่า "มีการกดใหม่" ไว้ (input latch)
 * จนส่งใน tick ถัดไป กดแล้วปล่อย หรือปล่อยแล้วกดซ้ำภายใน tick เดียวก็ไม่หาย
 * client ไม่จำว่าถือปืนอะไร แค่ส่งคำสั่งเปลี่ยนปืนตอนกด 1/2/3 ปืนจริงอยู่ใน PlayerState
 */
export class InputSampler {
  private readonly left: Phaser.Input.Keyboard.Key[];
  private readonly right: Phaser.Input.Keyboard.Key[];
  private readonly jump: Phaser.Input.Keyboard.Key[];
  private readonly pointer: Phaser.Input.Pointer;
  private jumpPressed = false;
  private firePressed = false;
  /** NO_SWITCH = ไม่ได้กดเปลี่ยนปืน, 0–2 = ลำดับปืนใน WEAPON_SLOTS (ปุ่ม 1/2/3) */
  private switchTo = NO_SWITCH;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('ไม่พบคีย์บอร์ด');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.left = [keyboard.addKey(K.A), keyboard.addKey(K.LEFT)];
    this.right = [keyboard.addKey(K.D), keyboard.addKey(K.RIGHT)];
    this.jump = [keyboard.addKey(K.W), keyboard.addKey(K.UP), keyboard.addKey(K.SPACE)];
    for (const key of this.jump) {
      key.on('down', () => {
        this.jumpPressed = true;
      });
    }
    WEAPON_SLOTS.forEach((_id, i) => {
      keyboard.addKey(K.ONE + i).on('down', () => {
        this.switchTo = i;
      });
    });

    this.pointer = scene.input.activePointer;
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) this.firePressed = true;
    });
    scene.input.mouse?.disableContextMenu();
  }

  /** เรียก 1 ครั้งต่อ tick เท่านั้น เพราะจะล้างค่าที่พักไว้ */
  sample(aim: number): PlayerInput {
    const input: PlayerInput = {
      left: this.left.some((key) => key.isDown),
      right: this.right.some((key) => key.isDown),
      jump: this.jumpPressed || this.jump.some((key) => key.isDown),
      jumpPressed: this.jumpPressed,
      fire: this.firePressed || this.pointer.leftButtonDown(),
      firePressed: this.firePressed,
      aim,
      switchTo: this.switchTo,
    };
    this.jumpPressed = false;
    this.firePressed = false;
    this.switchTo = NO_SWITCH;
    return input;
  }
}
