# Armor Game (ชื่อชั่วคราว)

เกมยิง 2D side-scrolling เล่นบนเบราว์เซอร์ ออนไลน์ 2–4 คนต่อห้อง + บอท
สร้างด้วย Phaser 4, Colyseus 0.18 และ TypeScript

**สถานะ:** เฟส 2 จาก 5 เล่นออนไลน์ได้หลายคนในห้องเดียว เดิน กระโดด เห็นกันขยับ (ยิงกันได้ในเฟส 3) ดูแผนทั้งหมดที่ [docs/plan.md](docs/plan.md)

## เริ่มรัน

ต้องมี Node.js 24 ขึ้นไป และ pnpm (`npm install -g pnpm`) แล้วเปิด 2 หน้าต่าง terminal

```bash
pnpm install
pnpm dev:server   # หน้าต่างที่ 1: เซิร์ฟเวอร์ที่ ws://localhost:2567
pnpm dev          # หน้าต่างที่ 2: เกมที่ http://localhost:5173 (เปิดหลายแท็บ = หลายผู้เล่น)
```

คำสั่งอื่น

```bash
pnpm test         # unit test ของฟิสิกส์และแมพ
pnpm typecheck    # เช็ก type ทั้ง 3 แพ็กเกจ
pnpm build        # build ตัวเกมเป็นไฟล์ static
```

ทดสอบตอนเน็ตแลค (PowerShell): `$env:COLYSEUS_LATENCY = '150'; pnpm dev:server`
แล้วเปิดเกมด้วย `http://localhost:5173/?netdebug` เพื่อดูแผง debug ของ Colyseus

## วิธีเล่น

| ปุ่ม | ทำอะไร |
| --- | --- |
| A / D | เดิน |
| W / Space | กระโดด (กดค้างจะสูงขึ้น) |
| เมาส์ + คลิกซ้าย | เล็งและยิง |
| 1 / 2 / 3 | ปืนพก / ไรเฟิล / ลูกซอง |
| H | แสดงกรอบชน (debug): ม่วง = ตัวเราที่ทำนาย, ฟ้า = ตำแหน่งจริงจากเซิร์ฟเวอร์ |

## โครงสร้าง

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `packages/shared` | ฟิสิกส์ (`step.ts`) แมพ ปืน schema ที่ส่งผ่านเน็ต (`netschema.ts`) ที่ client กับ server ใช้ร่วมกัน |
| `packages/shared/maps` | แมพจาก Tiled (JSON) |
| `packages/client` | ตัวเกม Phaser + Vite ต่อเซิร์ฟเวอร์ด้วย `@colyseus/sdk` |
| `packages/server` | เซิร์ฟเวอร์ Colyseus (`GameRoom.ts`) |
| `docs` | แผน (`plan.md`) และกฎของโปรเจกต์ (`rules.md`) |

โปรเจกต์นี้เขียนร่วมกับ AI (Claude และ Gemini) โดยทั้งคู่ทำตามกฎใน [docs/rules.md](docs/rules.md)

## Credits

ที่มาและ license ของภาพและเสียงอยู่ที่ [CREDITS.md](CREDITS.md)
