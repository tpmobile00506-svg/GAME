# Armor Game (ชื่อชั่วคราว)

เกมยิง 2D side-scrolling เล่นบนเบราว์เซอร์ ออนไลน์ 2–4 คนต่อห้อง + บอท
สร้างด้วย Phaser 4, Colyseus 0.18 และ TypeScript

**สถานะ:** เฟส 1 จาก 5 เล่นคนเดียวได้ เดิน กระโดด และยิงเป้าซ้อม ดูแผนทั้งหมดที่ [docs/plan.md](docs/plan.md)

## เริ่มรัน

ต้องมี Node.js 24 ขึ้นไป และ pnpm (`npm install -g pnpm`)

```bash
pnpm install
pnpm dev          # เปิดเกมที่ http://localhost:5173
pnpm dev:server   # รันเซิร์ฟเวอร์ (ตอนนี้ยังเป็น stub)
pnpm test         # unit test ของฟิสิกส์และแมพ
pnpm typecheck
pnpm build
```

## วิธีเล่น

| ปุ่ม | ทำอะไร |
| --- | --- |
| A / D | เดิน |
| W / Space | กระโดด (กดค้างจะสูงขึ้น) |
| เมาส์ + คลิกซ้าย | เล็งและยิง |
| 1 / 2 / 3 | ปืนพก / ไรเฟิล / ลูกซอง |
| H | แสดงกรอบชน (debug) |

## โครงสร้าง

| โฟลเดอร์ | หน้าที่ |
| --- | --- |
| `packages/shared` | ฟิสิกส์ (`step.ts`) แมพ ปืน และ type ที่ client กับ server ใช้ร่วมกัน |
| `packages/shared/maps` | แมพจาก Tiled (JSON) |
| `packages/client` | ตัวเกม Phaser + Vite |
| `packages/server` | เซิร์ฟเวอร์ Colyseus (เริ่มเฟส 2) |
| `docs` | แผน (`plan.md`) และกฎของโปรเจกต์ (`rules.md`) |

โปรเจกต์นี้เขียนร่วมกับ AI (Claude และ Gemini) โดยทั้งคู่ทำตามกฎใน [docs/rules.md](docs/rules.md)

## Credits

ที่มาและ license ของภาพและเสียงอยู่ที่ [CREDITS.md](CREDITS.md)
