# Armor Game — กฎของโปรเจกต์

## เกมนี้คืออะไร
เกมยิง 2D side-scrolling เล่นบนเบราว์เซอร์ ออนไลน์ 2–4 คนต่อห้อง + บอท

## Stack (เวอร์ชันที่ติดตั้งจริง)
- packages/client: Phaser 4.2 + TypeScript 7 + Vite 8
- packages/server: Colyseus 0.18 (`@colyseus/core`, `@colyseus/ws-transport`) บน Node.js 24 ใช้ netcode API ในตัว
- packages/client: ต่อเซิร์ฟเวอร์ด้วย `@colyseus/sdk` 0.18 (`Predict` ทำนายตัวเอง + lerp คนอื่น)
- packages/shared: ฟิสิกส์ แมพ ข้อมูลปืน type ของข้อความ และ schema ที่ส่งผ่านเน็ต (`netschema.ts` ใช้ `@colyseus/schema` 5) test ด้วย Vitest 5
- จัดการแพ็กเกจด้วย pnpm 12 (มีระบบกันแพ็กเกจที่เพิ่งออกไม่ถึง 1 วัน ห้ามปิดหรือเพิ่มข้อยกเว้นเอง ให้ใช้เวอร์ชันก่อนหน้าแทน)

## กฎห้ามฝ่าฝืน
- เซิร์ฟเวอร์ตัดสินทุกอย่าง: client ส่งแค่ input (ปุ่มที่กด + มุมเล็ง + คำสั่งเปลี่ยนปืน) ห้ามส่งตำแหน่ง HP หรือปืนที่ถืออยู่ และ client ห้ามเก็บ state เกมไว้เอง
- ฟิสิกส์และการชนอยู่ใน packages/shared/src/step.ts ไฟล์เดียว ทั้ง client และ server import ไปใช้
- step() อ่านข้อมูลจาก input เท่านั้น ห้ามใช้ Math.random() หรือ Date.now() ข้างใน
- อ่าน dt จาก ctx.dt และรอบย่อยจาก ctx.subSteps / ctx.subDt ห้ามเขียน 1/60 เอง (เซิร์ฟเวอร์ตั้งค่าที่ setFixedTimestep แล้ว Colyseus ส่งต่อให้ client)
- ทำตามลำดับของ Colyseus ทุกเฟรม: `predict.tick()` → ส่ง input เท่าจำนวน step ที่ได้ → ค่อยอ่าน `predict.value()` มาวาด
- ถ้าแก้ช่องใน `PlayerState` หรือ `PlayerInput` ต้องแก้ `shared/src/netschema.ts` ให้ตรงกัน (typecheck จะไม่ผ่านถ้าลืม) ตัวเลขฟิสิกส์ใน schema ใช้ `float64` เสมอ
- ทุกค่าที่ step() ใช้ตัดสินใจต้องอยู่ใน state ของผู้เล่น (เช่น coyote time, jump buffer, คูลดาวน์ปืน) ห้ามเก็บไว้ฝั่ง client อย่างเดียว ไม่งั้นต่อออนไลน์แล้วตัวละครจะเด้งกลับ
- ส่ง input 1 ครั้งต่อ fixed step และพักค่าปุ่มที่กดระหว่าง tick ไว้ (input latch) ไม่ให้คลิกสั้นๆ หาย การ "กดลงใหม่" ส่งเป็น `jumpPressed` / `firePressed` จาก client ห้ามหาเองใน step จากค่ากดค้าง
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
- Schema ของ Colyseus ประกาศแบบฟังก์ชัน `schema({ x: t.float64() }, 'Name')` ไม่ใช้ `@type` decorator ดูตัวอย่างใน `shared/src/netschema.ts`
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
- `pnpm dev:server` รันเซิร์ฟเวอร์ที่ ws://localhost:2567 (เปิดค้างไว้อีกหน้าต่าง)
- `pnpm dev` เปิดเกมที่ http://localhost:5173 (เปิดหลายแท็บ = หลายผู้เล่น)
- `pnpm test` รัน unit test ของ shared (Vitest)
- `pnpm typecheck` เช็ก type ทั้ง 3 แพ็กเกจ
- `pnpm build` build ตัวเกมเป็นไฟล์ static
- จำลองเน็ตแลค: `$env:COLYSEUS_LATENCY = '150'; pnpm dev:server` (มิลลิวินาที ไป-กลับ)
- เปิดเกมด้วย `http://localhost:5173/?netdebug` จะมีแผงของ Colyseus ไว้ดูว่าฟิสิกส์สองฝั่งตรงกันไหม

## สถานะปัจจุบัน (อัปเดตทุกครั้งที่จบฟีเจอร์)
- เฟส: 2
- เสร็จแล้ว: เฟส 1 ทั้งหมด, เฟส 2 ส่วน netcode คือ GameRoom (30 tick, 2 รอบย่อย, sanitize input), client ทำนายตัวเอง + lerp คนอื่น, โหมด debug แสดงตำแหน่งจริงจากเซิร์ฟเวอร์ (ฟ้า) ทับตำแหน่งที่ทำนาย (ม่วง), CI บน GitHub Actions
- ทดสอบแล้ว: 2 แท็บเห็นกันขยับ, แลคจำลอง 150 ms ตัวเราขยับทันทีและไม่เด้งกลับ, ตำแหน่งที่ทำนายตรงกับเซิร์ฟเวอร์ทุกบิต, สลับแท็บแล้วกลับมาได้
- กำลังทำ: -
- ถัดไป: เลือกสไตล์ art, เปิด tunnel ให้เพื่อนเข้าจากอีกเครื่อง (ด่านเฟส 2)
- หมายเหตุ: ภาพยังเป็น placeholder ที่สร้างเอง ยิงได้แค่เป้าซ้อมในเครื่องตัวเอง (ยิงกันออนไลน์คือเฟส 3)
