import type { WeaponId } from './weapons.ts';

/**
 * input 1 ชุดที่ client ส่งให้เซิร์ฟเวอร์ต่อ 1 tick
 * มีแค่ปุ่มที่กด มุมเล็ง และปืนที่เลือก ห้ามใส่ตำแหน่งหรือ HP
 */
export interface PlayerInput {
  readonly left: boolean;
  readonly right: boolean;
  /** ปุ่มกระโดดถูกกดค้างอยู่ หรือถูกกดระหว่าง tick นี้ (input latch) */
  readonly jump: boolean;
  /** ปุ่มยิงถูกกดค้างอยู่ หรือถูกกดระหว่าง tick นี้ (input latch) */
  readonly fire: boolean;
  /** มุมเล็งเป็นเรเดียน จากไหล่ไปหาเมาส์ในพิกัดโลก (0 = ขวา, บวก = ลง) */
  readonly aim: number;
  readonly weapon: WeaponId;
}
