import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const EMAIL = 'tmdcks0157@gmail.com';
const PASSWORD = 'chan@0157';
const OUT_DIR = './scripts/screenshots';

const PAGES = [
  { name: '01_today',    path: '/today' },
  { name: '02_kanban',   path: '/dashboard' },
  { name: '03_calendar', path: '/calendar' },
  { name: '04_report',   path: '/report' },
  { name: '05_crm',      path: '/crm' },
  { name: '06_overview', path: '/overview' },
  { name: '07_settings', path: '/settings' },
];

(async () => {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // 로그인
  console.log('로그인 중...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // 페이지별 스크린샷
  for (const { name, path } of PAGES) {
    console.log(`캡처 중: ${path}`);
    await page.goto(`${BASE_URL}${path}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
    console.log(`저장: ${name}.png`);
  }

  await browser.close();
  console.log('완료!');
})();
