const { execSync } = require('child_process');
const path = require('path');

const fonts = [
  'kanit/Kanit-Bold.ttf',
  'kanit/Kanit-Regular.ttf',
  'prompt/Prompt-Bold.ttf',
  'prompt/Prompt-Regular.ttf',
  'sarabun/Sarabun-Bold.ttf',
  'itim/Itim-Regular.ttf',
  'mali/Mali-Bold.ttf',
  'chonburi/Chonburi-Regular.ttf',
  'notosansthai/NotoSansThai-Bold.ttf',
  'mitr/Mitr-Medium.ttf'
];

const targetDir = path.resolve(__dirname, '../public/Font_stock');
console.log('📦 เริ่มดาวน์โหลดและติดตั้งฟอนต์สำหรับซับไตเติ้ล...');

for (const font of fonts) {
  const [family, filename] = font.split('/');
  const url = `https://github.com/google/fonts/raw/main/ofl/${family}/${filename}`;
  const outPath = path.join(targetDir, filename);
  
  try {
    console.log(`- ⬇️ ดาวน์โหลด: ${filename}...`);
    execSync(`curl -sL "${url}" -o "${outPath}"`);
  } catch (e) {
    console.error(`❌ ผิดพลาดตอนโหลด ${filename}:`, e.message);
  }
}
console.log('✅ โหลดฟอนต์สไตล์ CapCut เรียบร้อยพร้อมใช้งานในระบบแล้วฮะบอส!');
