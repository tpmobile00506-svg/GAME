/**
 * input 1 ชุดที่ client ส่งให้เซิร์ฟเวอร์ต่อ 1 tick
 * มีแค่ปุ่มที่กด มุมเล็ง และคำสั่งเปลี่ยนปืน ห้ามใส่ตำแหน่ง HP หรือปืนที่ถืออยู่ (เซิร์ฟเวอร์เก็บเอง)
 * ทุกช่องต้องเป็น boolean หรือตัวเลข เพราะ input ของ Colyseus รับได้แค่ค่าพื้นฐาน
 * ถ้าแก้ช่องในนี้ ต้องแก้ InputSchema ใน packages/server/src/schema.ts ให้ตรงกันด้วย (typecheck จะเตือน)
 */
export interface PlayerInput {
  left: boolean;
  right: boolean;
  /** ปุ่มกระโดดถูกกดค้างอยู่ (ใช้ตัดความสูงเมื่อปล่อยเร็ว) */
  jump: boolean;
  /** มีการกดปุ่มกระโดดลงไปใหม่ตั้งแต่ tick ก่อน (input latch) แม้จะปล่อยแล้วกดซ้ำภายใน tick เดียวก็นับ */
  jumpPressed: boolean;
  /** ปุ่มยิงถูกกดค้างอยู่ (ปืนอัตโนมัติใช้ค่านี้) */
  fire: boolean;
  /** มีการกดปุ่มยิงลงไปใหม่ตั้งแต่ tick ก่อน (ปืนที่ต้องกดทีละนัดใช้ค่านี้) */
  firePressed: boolean;
  /** มุมเล็งเป็นเรเดียน จากไหล่ไปหาเมาส์ในพิกัดโลก (0 = ขวา, บวก = ลง) อยู่ในช่วง -π ถึง π */
  aim: number;
  /** กดปุ่มเปลี่ยนปืนใน tick นี้: 0 = ไม่ได้กด, 1–3 = ปุ่ม 1/2/3 (ลำดับใน WEAPON_SLOTS + 1) */
  switchTo: number;
}

/** input ว่าง (ไม่ได้กดอะไร) ใช้เป็นค่าเริ่มต้น */
export function emptyInput(aim = 0): PlayerInput {
  return { left: false, right: false, jump: false, jumpPressed: false, fire: false, firePressed: false, aim, switchTo: 0 };
}
