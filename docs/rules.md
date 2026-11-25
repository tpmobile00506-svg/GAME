# Armor Game — กฎของโปรเจกต์

## เกมนี้คืออะไร
เกมยิง 2D side-scrolling เล่นบนเบราว์เซอร์ ออนไลน์ 2–4 คนต่อห้อง + บอท

## Stack (เวอร์ชันที่ติดตั้งจริง)
- packages/client: Phaser 4.2 + TypeScript 7 + Vite 8
- packages/server: Colyseus 0.18+ บน Node.js 24 (ใช้ netcode API ในตัว)
- packages/shared: ฟิสิกส์ แมพ ข้อมูลปืน type ของข้อความ (test ด้วย Vitest 5)
- จัดการแพ็กเกจด้วย pnpm 12

## กฎห้ามฝ่าฝืน
- เซิร์ฟเวอร์ตัดสินทุกอย่าง: client ส่งแค่ input (ปุ่มที่กด + มุมเล็ง + ปืนที่เลือก) ห้ามส่งตำแหน่งหรือ HP
- ฟิสิกส์และการชนอยู่ใน packages/shared/src/step.ts ไฟล์เดียว ทั้ง client และ server import ไปใช้
- step() อ่านข้อมูลจาก input เท่านั้น ห้ามใช้ Math.random() หรือ Date.now() ข้างใน
- อ่าน dt จาก ctx.dt ห้ามเขียน 1/60 เอง
- ทุกค่าที่ step() ใช้ตัดสินใจต้องอยู่ใน state ของผู้เล่น (เช่น coyote time, jump buffer, คูลดาวน์ปืน) ห้ามเก็บไว้ฝั่ง client อย่างเดียว ไม่งั้นต่อออนไลน์แล้วตัวละครจะเด้งกลับ
- ส่ง input 1 ครั้งต่อ fixed step และพักค่าปุ่มที่กดระหว่าง tick ไว้ (input latch) ไม่ให้คลิกสั้นๆ หาย
- มุมเล็งคำนวณจากพิกัดในโลกเกม (ผ่านกล้อง) ไม่ใช่พิกัดบนจอ
- เสียงและเอฟเฟกต์อยู่ใน if (!ctx.isReplay) เท่านั้น
- ห้ามใช้ Arcade Physics ของ Phaser กับตัวละครผู้เล่น
- ค่าปืนอยู่ใน shared/src/weapons.ts ห้าม hardcode ที่อื่น ลูกซองใช้มุมกระจายคงที่ ห้ามสุ่ม
- การยิงแบ่งเป็น 2 ส่วน: step() ดูแลคูลดาวน์และบอกว่า "ยิงออกไปแล้ว" ส่วนการเช็กว่าโดนอะไรใช้ resolveShot() ใน shared ซึ่งเซิร์ฟเวอร์จะเรียกด้วยตำแหน่งที่ย้อนเวลาแล้ว
- ตรรกะเกมที่ต้อง test ได้ (ฟิสิกส์ การชน ดาเมจ เกราะ raycast) อยู่ใน shared
- TypeScript strict ห้ามใช้ any
- เซิร์ฟเวอร์เช็ก input ทุกชุดก่อนใช้ (ชนิดข้อมูล มุมเป็นตัวเลขจริง ปืนอยู่ในรายการ ไม่เกิน 1 ชุดต่อ tick) และแสดงชื่อผู้เล่นด้วย `textContent` เท่านั้น
- บอทสุ่มได้เฉพาะในโค้ดตัดสินใจของบอทบนเซิร์ฟเวอร์ ซึ่งผลลัพธ์คือ input ห้ามสุ่มใน step()
- กติกาเกม (HP เกราะ เวลาเกิดใหม่ เวลาแมตช์) อยู่ใน shared ตามตาราง "กติกาเกม" ใน plan.md
- ห้ามอัปเกรด major version ของไลบรารีกลางโปรเจกต์โดยไม่ถามก่อน
- ห้าม commit `.env`, `node_modules`, `dist` ทำงานบน branch `feat/...` แล้ว merge เข้า `main` ผ่าน Pull Request หลัง CI ผ่านและ AI อีกตัวรีวิว
- ห้ามเพิ่มไลบรารีใหม่โดยไม่ถามก่อน
- ทำทีละฟีเจอร์ แก้เฉพาะไฟล์ที่เกี่ยวข้อง
- แก้เสร็จแล้วสรุปสิ่งที่เปลี่ยนเป็นภาษาไทย พร้อมวิธีทดสอบ

## ข้อตกลงโค้ด
- import ไฟล์ในโปรเจกต์ต้องใส่นามสกุล `.ts` เสมอ เช่น `import { stepPlayer } from './step.ts'` เพราะเซิร์ฟเวอร์รัน TypeScript ตรงด้วย Node โดยไม่ build
- ห้ามใช้ `enum`, `namespace`, parameter property ใน constructor และ decorator (เช่น `@type`) เพราะ Node รันไม่ได้ ให้ใช้ object `as const` กับ union type แทน
- Schema ของ Colyseus ให้ประกาศแบบฟังก์ชัน (schema builder) ไม่ใช้ `@type` decorator ชื่อ API ที่ถูกต้องให้เช็กจาก docs ของ 0.18 ตอนเริ่มเฟส 2
- ห้ามเขียน API จากความจำ: Phaser 4 กับ Colyseus 0.18 ต่างจากตัวอย่างเก่าบนเว็บ (Phaser 3, Colyseus 0.14–0.16) ให้เช็ก type ใน node_modules หรือ docs ของเวอร์ชันที่ติดตั้งก่อนใช้
- client กับ server import โค้ดกลางผ่าน `@armor/shared` เท่านั้น ห้าม import ข้ามแพ็กเกจด้วย path ตรง

## แมพ (Tiled)
- ไฟล์แมพอยู่ที่ `packages/shared/maps/*.json` ทั้ง client และ server ใช้ไฟล์เดียวกัน
- ภาพ tileset อยู่ที่ `packages/client/public/tiles/` (เซิร์ฟเวอร์ไม่ต้องใช้ภาพ)
- ตั้งค่าใน Tiled: tile ขนาด 32×32, ห้ามเปิด Infinite, Tile layer format = CSV, tileset ต้อง Embed in map, เซฟเป็น JSON
- tile layer ชื่อ `solid` = ทุก tile ในนี้ชนได้
- object layer ชื่อ `spawns` = จุดเกิด ใช้ point object ตั้งชื่อ `player` หรือ `dummy` (วางที่ระดับเท้า)
- แต่ละแมพต้องมีจุดเกิด `player` อย่างน้อย 6 จุด กระจายทั่วแมพ
- ระยะที่ตัวละครไปถึงได้ (คิดจากค่าใน PHYSICS ตอนนี้): ขึ้นสูงได้ไม่เกิน 3 tile · ถ้าขึ้นสูง 3 tile ช่องว่างแนวนอนต้องไม่เกิน 2 tile · ถ้าอยู่ระดับเดียวกันกระโดดข้ามช่องได้ไม่เกิน 4 tile · ถ้าแก้ PHYSICS ต้องเช็กแมพทุกแมพใหม่

## Asset และ UI
- ภาพและเสียงอยู่ที่ `packages/client/public/` แยกเป็น `tiles/`, `sprites/`, `sfx/`, `music/`
- asset ทุกชิ้นต้องจดใน `CREDITS.md` (ไฟล์ ที่มา license) ก่อน commit และใช้แบบ CC0 ก่อน
- tile 32×32 · ตัวละครอยู่ในกรอบ 32×48 ให้ตรงกับกล่องชน 22×44 · แขนกับปืนเป็นภาพแยกจากตัว
- ข้อความภาษาไทยทำด้วย HTML/CSS ทับบนเกม ห้ามใช้ Text ของ Phaser กับภาษาไทย
- เริ่มเล่นเสียงหลังผู้เล่นคลิกครั้งแรกเท่านั้น

## คำสั่ง (รันที่ root ของ repo)
- `pnpm install` ติดตั้งทุกแพ็กเกจ
- `pnpm dev` เปิดเกมที่ http://localhost:5173
- `pnpm dev:server` รันเซิร์ฟเวอร์
- `pnpm test` รัน unit test ของ shared (Vitest)
- `pnpm typecheck` เช็ก type ทั้ง 3 แพ็กเกจ
- `pnpm build` build ตัวเกมเป็นไฟล์ static

## สถานะปัจจุบัน (อัปเดตทุกครั้งที่จบฟีเจอร์)
- เฟส: 1 (งานครบแล้ว รอผ่านด่าน)
- เสร็จแล้ว: ตั้ง repo, ปรับแผนตามรีวิวของ Gemini, demo เฟส 1 คือแมพ arena (shared/maps), stepPlayer() พร้อม sub-step / coyote / jump buffer, เล็งและยิงปืน 3 แบบใส่เป้าซ้อม, input latch, โหมด debug (H), test 20 ข้อ
- กำลังทำ: -
- ถัดไป: ผ่านด่านเฟส 1 (ลองเล่นแล้วปรับค่าใน PHYSICS ให้กระโดดแม่นมือ) แล้วเริ่มเฟส 2
- หมายเหตุ: ภาพยังเป็น placeholder ที่สร้างเอง เปลี่ยนเป็น asset จริงได้ทีหลังโดยแก้แค่ tileset ใน Tiled
