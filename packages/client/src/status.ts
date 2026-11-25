/** แสดงข้อความสถานะการเชื่อมต่อกลางจอ (HTML เพราะ canvas ของ Phaser ตัดสระภาษาไทย) ส่ง null เพื่อซ่อน */
export function setStatus(text: string | null): void {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = text ?? '';
  el.hidden = text === null;
}
