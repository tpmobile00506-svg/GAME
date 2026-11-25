import type { WeaponId } from './weapons.ts';

/**
 * input 1 ชุดที่ client ส่งให้เซิร์ฟเวอร์ต่อ 1 tick
 * มีแค่ปุ่มที่กด มุมเล็ง และคำสั่งเปลี่ยนปืน ห้ามใส่ตำแหน่ง HP หรือปืนที่ถืออยู่ (เซิร์ฟเวอร์เก็บเอง)
 */
export interface PlayerInput {
  readonly left: boolean;
  readonly right: boolean;
  /** ปุ่มกระโดดถูกกดค้างอยู่ (ใช้ตัดความสูงเมื่อปล่อยเร็ว) */
  readonly jump: boolean;
  /** มีการกดปุ่มกระโดดลงไปใหม่ตั้งแต่ tick ก่อน (input latch) แม้จะปล่อยแล้วกดซ้ำภายใน tick เดียวก็นับ */
  readonly jumpPressed: boolean;
  /** ปุ่มยิงถูกกดค้างอยู่ (ปืนอัตโนมัติใช้ค่านี้) */
  readonly fire: boolean;
  /** มีการกดปุ่มยิงลงไปใหม่ตั้งแต่ tick ก่อน (ปืนที่ต้องกดทีละนัดใช้ค่านี้) */
  readonly firePressed: boolean;
  /** มุมเล็งเป็นเรเดียน จากไหล่ไปหาเมาส์ในพิกัดโลก (0 = ขวา, บวก = ลง) */
  readonly aim: number;
  /** กดปุ่มเปลี่ยนปืนใน tick นี้ หรือ null ถ้าไม่ได้กด */
  readonly switchTo: WeaponId | null;
}
