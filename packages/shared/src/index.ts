// โค้ดกลางที่ทั้ง client และ server import ไปใช้
// ไฟล์ในแพ็กเกจนี้ไม่มี lib ของเบราว์เซอร์หรือ Node ให้ใช้ (ดู tsconfig.json) เพื่อให้รันได้ทั้งสองฝั่ง
// ไลบรารีภายนอกที่ใช้ได้มีแค่ @colyseus/schema (สำหรับ netschema.ts)

/** จำนวน tick ต่อวินาที ใช้ตั้ง fixed step ของ client และเซิร์ฟเวอร์ ใน step() ให้อ่าน ctx.dt */
export const TICK_RATE = 30;

export * from './map.ts';
export * from './messages.ts';
export * from './netschema.ts';
export * from './step.ts';
export * from './weapons.ts';
