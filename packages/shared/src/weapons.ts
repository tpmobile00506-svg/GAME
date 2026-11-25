// ค่าปืนทั้งหมดของเกม ห้าม hardcode ที่อื่น (ดู docs/rules.md)
// หน่วย: เวลาเป็นวินาที ระยะเป็นพิกเซล มุมเป็นเรเดียน

export type WeaponId = 'pistol' | 'rifle' | 'shotgun';

export interface WeaponDef {
  readonly label: string;
  /** เวลาขั้นต่ำระหว่างนัด */
  readonly fireInterval: number;
  /** true = กดค้างแล้วยิงต่อเนื่อง, false = ต้องปล่อยแล้วกดใหม่ทุกนัด */
  readonly automatic: boolean;
  readonly damage: number;
  readonly range: number;
  /** มุมเบี่ยงของกระสุนแต่ละเม็ดเทียบกับมุมเล็ง ใช้ค่าคงที่ ห้ามสุ่ม เพื่อให้ client กับเซิร์ฟเวอร์ได้ผลตรงกัน */
  readonly spread: readonly number[];
}

export const WEAPONS: Readonly<Record<WeaponId, WeaponDef>> = {
  pistol: { label: 'Pistol', fireInterval: 0.25, automatic: false, damage: 20, range: 900, spread: [0] },
  rifle: { label: 'Rifle', fireInterval: 0.1, automatic: true, damage: 12, range: 1200, spread: [0] },
  shotgun: { label: 'Shotgun', fireInterval: 0.8, automatic: false, damage: 10, range: 450, spread: [-0.16, -0.08, 0, 0.08, 0.16] },
};

/** ลำดับปืนตามปุ่ม 1 / 2 / 3 */
export const WEAPON_SLOTS: readonly WeaponId[] = ['pistol', 'rifle', 'shotgun'];

/** ยิงไม่ได้ช่วงสั้นๆ หลังสลับปืน */
export const WEAPON_SWITCH_TIME = 0.2;
