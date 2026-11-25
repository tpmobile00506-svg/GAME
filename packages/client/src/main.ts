import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.ts';

// ไม่เปิด Arcade Physics: ฟิสิกส์ตัวละครอยู่ใน @armor/shared (ดู docs/rules.md)
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#1b1f2a',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});

// ตอน dev เปิด console แล้วพิมพ์ game ได้ เช่น game.scene.getScene('game').player ไว้ดู state จริง
if (import.meta.env.DEV) Object.assign(window, { game });
