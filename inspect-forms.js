const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto('https://www.theautomationchallenge.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  const elements = await page.locator('input, textarea, select, button, a').evaluateAll((els) =>
    els.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim(),
      value: (el.value || '').trim(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      id: el.getAttribute('id') || '',
      placeholder: el.getAttribute('placeholder') || '',
      aria: el.getAttribute('aria-label') || '',
      href: el.getAttribute('href') || '',
      html: el.outerHTML.slice(0, 220)
    }))
  );

  console.log(JSON.stringify(elements, null, 2));
  await browser.close();
})();
