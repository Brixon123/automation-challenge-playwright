const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto('https://www.theautomationchallenge.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('BEFORE START');
  const before = await page.locator('input, textarea, select, button, a').evaluateAll((els) =>
    els.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      placeholder: el.getAttribute('placeholder') || '',
      aria: el.getAttribute('aria-label') || '',
      href: el.getAttribute('href') || ''
    }))
  );
  console.log(JSON.stringify(before, null, 2));

  await page.locator('button:has-text("Start")').click();
  await page.waitForTimeout(3000);

  console.log('AFTER START');
  const after = await page.locator('input, textarea, select, button, a').evaluateAll((els) =>
    els.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      placeholder: el.getAttribute('placeholder') || '',
      aria: el.getAttribute('aria-label') || '',
      href: el.getAttribute('href') || ''
    }))
  );
  console.log(JSON.stringify(after, null, 2));

  await browser.close();
})();
