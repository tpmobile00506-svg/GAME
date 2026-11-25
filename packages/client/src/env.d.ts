// ตัวแปรที่ตั้งได้ตอน build เช่น VITE_SERVER_URL=wss://example.com pnpm build
interface ImportMetaEnv {
  /** ที่อยู่เซิร์ฟเวอร์เกม ถ้าไม่ตั้ง จะใช้ ws://<โฮสต์เดียวกับหน้าเว็บ>:2567 */
  readonly VITE_SERVER_URL?: string;
}
