import { describe, expect, it } from 'vitest';
import { TICK_RATE } from './index.ts';
import { ARENA, isSolid, parseTiledMap, pickSpawn } from './map.ts';
import { emptyInput } from './messages.ts';
import { PHYSICS, createPlayer, stepPlayer } from './step.ts';

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

  it('แมพ arena: มีจุดเกิด player อย่างน้อย 6 จุด ทุกจุดมีที่ว่างพอทั้งตัวและมีพื้นรองเท้า', () => {
    expect(ARENA.playerSpawns.length).toBeGreaterThanOrEqual(6);
    const t = ARENA.tileSize;
    for (const spawn of [...ARENA.playerSpawns, ...ARENA.dummySpawns]) {
      const where = `จุดเกิด (${spawn.x}, ${spawn.y})`;
      const left = Math.floor((spawn.x - PHYSICS.halfWidth) / t);
      const right = Math.floor((spawn.x + PHYSICS.halfWidth - 1e-6) / t);
      const top = Math.floor((spawn.y - PHYSICS.halfHeight * 2) / t);
      const bottom = Math.floor((spawn.y - 1e-6) / t);
      for (let ty = top; ty <= bottom; ty++) {
        for (let tx = left; tx <= right; tx++) expect(isSolid(ARENA, tx, ty), where).toBe(false);
      }
      expect(isSolid(ARENA, Math.floor(spawn.x / t), Math.floor(spawn.y / t)), where).toBe(true);
    }
  });

  it('แมพ arena: เกิดที่จุดไหนก็ยืนบนพื้นได้ ไม่ขยับเอง', () => {
    const dt = 1 / TICK_RATE;
    const ctx = { dt, subSteps: PHYSICS.substeps, subDt: dt / PHYSICS.substeps, isReplay: false };
    for (const spawn of ARENA.playerSpawns) {
      const p = createPlayer(spawn.x, spawn.y);
      for (let i = 0; i < 10; i++) stepPlayer(p, emptyInput(), ARENA, ctx);
      expect(p.onGround).toBe(true);
      expect(p.x).toBe(spawn.x);
      expect(p.y + PHYSICS.halfHeight).toBe(spawn.y);
    }
  });

  it('เลือกจุดเกิดที่ไกลจากผู้เล่นคนอื่นที่สุด', () => {
    const spawns = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 300, y: 0 },
    ];
    expect(pickSpawn(spawns, [])).toEqual({ x: 0, y: 0 });
    expect(pickSpawn(spawns, [{ x: 10, y: 0 }])).toEqual({ x: 300, y: 0 });
    expect(pickSpawn(spawns, [{ x: 0, y: 0 }, { x: 300, y: 0 }])).toEqual({ x: 100, y: 0 });
  });

  it('แมพ arena: มีเพดาน กระสุนยิงขึ้นฟ้าไปหยุดที่ tile ไม่ใช่ขอบนอกแมพ', () => {
    for (let tx = 0; tx < ARENA.width; tx++) expect(isSolid(ARENA, tx, 0)).toBe(true);
  });
});
