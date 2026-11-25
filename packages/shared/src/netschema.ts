// โครงสร้างข้อมูลที่ส่งผ่านเน็ตระหว่าง client กับเซิร์ฟเวอร์ (Colyseus schema)
// ประกาศแบบฟังก์ชัน schema() ไม่ใช้ @type decorator (ดู docs/rules.md)
// ตัวเลขฟิสิกส์ใช้ float64 ทั้งหมด ให้ค่าที่ client ได้รับตรงกับที่เซิร์ฟเวอร์คำนวณทุกบิต prediction จะได้ไม่เพี้ยน
import { schema, t, type SchemaType } from '@colyseus/schema';
import type { PlayerInput } from './messages.ts';
import type { PlayerState } from './step.ts';

/** input 1 ชุดต่อ tick ต้องมีช่องเหมือน PlayerInput ทุกช่อง */
export const InputSchema = schema(
  {
    left: t.boolean(),
    right: t.boolean(),
    jump: t.boolean(),
    jumpPressed: t.boolean(),
    fire: t.boolean(),
    firePressed: t.boolean(),
    aim: t.float64(),
    switchTo: t.uint8(),
  },
  'PlayerInput',
);

/** ผู้เล่น 1 คน ต้องมีช่องเหมือน PlayerState ทุกช่อง */
export const PlayerSchema = schema(
  {
    x: t.float64(),
    y: t.float64(),
    vx: t.float64(),
    vy: t.float64(),
    onGround: t.boolean(),
    coyote: t.float64(),
    jumpBuffer: t.float64(),
    weapon: t.uint8(),
    cooldown: t.float64(),
    aim: t.float64(),
  },
  'Player',
);

/** state ทั้งห้อง: ผู้เล่นทุกคน key คือ sessionId */
export const GameStateSchema = schema({ players: t.map(PlayerSchema) }, 'GameState');

export type InputMessage = SchemaType<typeof InputSchema>;
export type PlayerEntity = SchemaType<typeof PlayerSchema>;
export type GameState = SchemaType<typeof GameStateSchema>;

// ถ้า schema ข้างบนไม่ตรงกับ PlayerInput / PlayerState สองบรรทัดนี้จะ typecheck ไม่ผ่าน
type Assert<T extends true> = T;
export type InputSchemaMatchesPlayerInput = Assert<InputMessage extends PlayerInput ? true : false>;
export type PlayerSchemaMatchesPlayerState = Assert<PlayerEntity extends PlayerState ? true : false>;
