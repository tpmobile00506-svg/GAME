import { describe, expect, it } from 'vitest';
import { TICK_RATE } from './index.ts';
import { ARENA, isSolid, parseTiledMap } from './map.ts';
import { createPlayer, stepPlayer } from './step.ts';

/** แมพ Tiled ขนาดเล็กที่ถูกต้อง แก้บางค่าเพื่อทดสอบกรณีผิดได้ */
function tinyTiledMap(overrides: { solidLayer?: Record<string, unknown>; map?: Record<string, unknown> } = {}): unknown {
  return {
    width: 2,
    height: 2,
    tilewidth: 32,
    tileheight: 32,
    orientation: 'orthogonal',
    infinite: false,
    tilesets: [{ firstgid: 1, name: 't', image: 't.png' }],
    layers: [
      { name: 'solid', type: 'tilelayer', width: 2, height: 2, data: [0, 0, 1, 1], ...overrides.solidLayer },
      { name: 'spawns', type: 'objectgroup', objects: [{ name: 'player', x: 16, y: 32 }] },
    ],
    ...overrides.map,
  };
}

describe('แมพ', () => {
  it('อ่านแมพ Tiled ได้ตาราง solid และจุดเกิด', () => {
    const map = parseTiledMap(tinyTiledMap());
    expect([...map.solid]).toEqual([0, 0, 1, 1]);
    expect(map.playerSpawns).toEqual([{ x: 16, y: 32 }]);
    expect(isSolid(map, 0, 1)).toBe(true);
    expect(isSolid(map, 0, 0)).toBe(false);
    expect(isSolid(map, -1, 0)).toBe(true);
  });

  it('บอกสาเหตุเมื่อตั้งค่า Tiled ผิด', () => {
    expect(() => parseTiledMap(tinyTiledMap({ map: { infinite: true } }))).toThrow(/Infinite/);
    expect(() => parseTiledMap(tinyTiledMap({ solidLayer: { encoding: 'base64', data: 'AAAA' } }))).toThrow(/CSV/);
    expect(() => parseTiledMap(tinyTiledMap({ map: { tilesets: [{ firstgid: 1, source: 't.tsx' }] } }))).toThrow(/Embed/);
    expect(() => parseTiledMap(tinyTiledMap({ solidLayer: { name: 'ground' } }))).toThrow(/solid/);
  });

  it('แมพ arena: จุดเกิดทุกจุดอยู่ในที่ว่างและมีพื้นรองเท้า', () => {
    expect(ARENA.playerSpawns.length).toBeGreaterThan(0);
    for (const spawn of [...ARENA.playerSpawns, ...ARENA.dummySpawns]) {
      const tx = Math.floor(spawn.x / ARENA.tileSize);
      expect(isSolid(ARENA, tx, Math.floor((spawn.y - 1) / ARENA.tileSize))).toBe(false);
      expect(isSolid(ARENA, tx, Math.floor(spawn.y / ARENA.tileSize))).toBe(true);
    }
  });

  it('แมพ arena: เกิดแล้วยืนบนพื้นได้ ไม่ติดกำแพง', () => {
    const spawn = ARENA.playerSpawns[0] ?? { x: 0, y: 0 };
    const p = createPlayer(spawn.x, spawn.y);
    for (let i = 0; i < 10; i++) {
      stepPlayer(p, { left: false, right: false, jump: false, fire: false, aim: 0, weapon: 'pistol' }, ARENA, { dt: 1 / TICK_RATE, isReplay: false });
    }
    expect(p.onGround).toBe(true);
    expect(p.x).toBe(spawn.x);
  });
});
