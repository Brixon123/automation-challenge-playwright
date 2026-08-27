const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto('https://www.theautomationchallenge.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.locator('button:has-text("Start")').click();
  await page.waitForTimeout(2000);
  await page.locator('input[placeholder="First Name"]').fill('Automation');
  await page.locator('input[placeholder="Last Name"]').fill('Tester');
  await page.locator('input[placeholder="Email"]').fill(`autotest-${Date.now()}@example.com`);
  await page.locator('input[placeholder="Password"]').fill('ChallengePass123!');
  await page.getByRole('button', { name: /^SIGN UP$/i }).click();
  await page.waitForTimeout(8000);

  const ids = await page.locator('input, textarea, select, button').evaluateAll((els) =>
    els.map((el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.getAttribute('id') || '',
      placeholder: el.getAttribute('placeholder') || '',
      type: el.getAttribute('type') || '',
      text: (el.textContent || '').trim(),
      aria: el.getAttribute('aria-label') || ''
    }))
  );
  console.log(JSON.stringify(ids, null, 2));
  console.log('PAGE_TEXT', (await page.locator('body').innerText()).slice(0, 6000));
  await browser.close();
})();
