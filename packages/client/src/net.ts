import { Callbacks, Client, Predict } from '@colyseus/sdk';
import { GameStateSchema, type PlayerInput } from '@armor/shared';

/** ที่อยู่เซิร์ฟเวอร์: ตั้งด้วย VITE_SERVER_URL ได้ ถ้าไม่ตั้งใช้เครื่องเดียวกับหน้าเว็บ (เพื่อนในวง LAN เข้าได้ด้วย) */
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:2567`;

/** ผู้เล่นคนอื่นแสดงย้อนหลังเท่านี้ (มิลลิวินาที) เพื่อให้ขยับลื่น ควรมากกว่ารอบส่ง state 1–2 รอบ */
export const REMOTE_DELAY_MS = 100;

/**
 * ต่อเข้าห้องเกม แล้วเตรียมตัวช่วย netcode ของ Colyseus:
 * - predict: ทำนายตัวเอง (reconciler) และทำให้คนอื่นขยับลื่น (lerp)
 * - input: ช่องส่ง input 1 ชุดต่อ fixed step
 */
export async function connectToGame(url: string = SERVER_URL) {
  const client = new Client(url);
  const room = await client.joinOrCreate('game', {}, GameStateSchema);
  const input = room.input<PlayerInput>();
  if (input.tickRate === undefined) throw new Error('เซิร์ฟเวอร์ไม่ได้ประกาศ tick rate (ต้องเรียก setFixedTimestep)');

  const predict = Predict.get(room, { mode: 'lerp', delay: REMOTE_DELAY_MS });
  predict.attachAll('players', { mode: 'lerp', fields: ['x', 'y'] });
  predict.attachAll('players', { mode: 'lerp', fields: ['aim'], angle: true });

  const callbacks = Callbacks.get(room);
  return { room, input, predict, callbacks };
}

export type NetSession = Awaited<ReturnType<typeof connectToGame>>;
