// อ่านแมพจาก Tiled (JSON) ให้เป็นตารางการชนที่ทั้ง client และ server ใช้ร่วมกัน
// วิธีตั้งค่าแมพใน Tiled ดูหัวข้อ "แมพ (Tiled)" ใน docs/rules.md
import arenaJson from '../maps/arena.json' with { type: 'json' };

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface GameMap {
  /** ขนาดแมพเป็นจำนวน tile */
  readonly width: number;
  readonly height: number;
  /** ขนาด tile เป็นพิกเซล */
  readonly tileSize: number;
  /** 1 = tile ชนได้ เก็บเรียงทีละแถว: index = ty * width + tx */
  readonly solid: Uint8Array;
  /** จุดเกิดผู้เล่น (ระดับเท้า) */
  readonly playerSpawns: readonly Point[];
  /** จุดวางเป้าซ้อมยิง (ระดับเท้า) ใช้ใน demo เฟส 1 */
  readonly dummySpawns: readonly Point[];
}

/** tile ที่ (tx, ty) ชนได้ไหม นอกขอบแมพนับว่าชนได้ ตัวละครจะได้ไม่หลุดออกไป */
export function isSolid(map: GameMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.solid[ty * map.width + tx] === 1;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, what: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`แมพผิดรูปแบบ: ${what} ต้องเป็น object`);
  }
  return value as JsonObject;
}

function asNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`แมพผิดรูปแบบ: ${what} ต้องเป็นตัวเลข`);
  }
  return value;
}

function asArray(value: unknown, what: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`แมพผิดรูปแบบ: ${what} ต้องเป็น array`);
  return value;
}

/** แปลง JSON จาก Tiled เป็น GameMap พร้อมเช็กค่าที่ตั้งผิดบ่อยใน Tiled */
export function parseTiledMap(json: unknown): GameMap {
  const map = asObject(json, 'map');
  if (map.infinite === true) throw new Error('แมพต้องไม่ใช่ Infinite (ปิดใน Tiled: Map > Map Properties)');
  if (map.orientation !== 'orthogonal') throw new Error('แมพต้องเป็น Orthogonal');

  const width = asNumber(map.width, 'width');
  const height = asNumber(map.height, 'height');
  const tileSize = asNumber(map.tilewidth, 'tilewidth');
  if (asNumber(map.tileheight, 'tileheight') !== tileSize) throw new Error('tile ต้องกว้างเท่ากับสูง');

  for (const [i, tileset] of asArray(map.tilesets, 'tilesets').entries()) {
    if (asObject(tileset, `tilesets[${i}]`).source !== undefined) {
      throw new Error('tileset ต้อง Embed in map (ห้ามแยกเป็นไฟล์ .tsx)');
    }
  }

  const layers = asArray(map.layers, 'layers').map((layer, i) => asObject(layer, `layers[${i}]`));

  const solidLayer = layers.find((layer) => layer.name === 'solid');
  if (!solidLayer || solidLayer.type !== 'tilelayer') throw new Error('ไม่พบ tile layer ชื่อ "solid"');
  if (solidLayer.encoding !== undefined && solidLayer.encoding !== 'csv') {
    throw new Error('Tile layer format ต้องเป็น CSV (ตั้งใน Map Properties)');
  }
  const data = asArray(solidLayer.data, 'solid.data');
  if (data.length !== width * height) throw new Error('จำนวน tile ใน layer "solid" ไม่เท่ากับขนาดแมพ');
  const solid = new Uint8Array(width * height);
  data.forEach((gid, i) => {
    solid[i] = asNumber(gid, `solid.data[${i}]`) !== 0 ? 1 : 0;
  });

  const playerSpawns: Point[] = [];
  const dummySpawns: Point[] = [];
  const spawnLayer = layers.find((layer) => layer.name === 'spawns');
  if (spawnLayer) {
    for (const [i, raw] of asArray(spawnLayer.objects, 'spawns.objects').entries()) {
      const obj = asObject(raw, `spawns.objects[${i}]`);
      const point = { x: asNumber(obj.x, 'spawn.x'), y: asNumber(obj.y, 'spawn.y') };
      if (obj.name === 'player') playerSpawns.push(point);
      else if (obj.name === 'dummy') dummySpawns.push(point);
    }
  }
  if (playerSpawns.length === 0) throw new Error('ต้องมี point ชื่อ "player" อย่างน้อย 1 จุดใน object layer "spawns"');

  return { width, height, tileSize, solid, playerSpawns, dummySpawns };
}

/** แมพแรกของเกม: ARENA_TILED ส่งให้ Phaser วาดภาพ ส่วน ARENA ใช้คำนวณการชน */
export const ARENA_TILED: object = arenaJson;
export const ARENA: GameMap = parseTiledMap(arenaJson);
