const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto('https://www.theautomationchallenge.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('button:has-text("Start")').click();
  await page.waitForTimeout(5000);
  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());
  const bodyText = await page.locator('body').innerText();
  console.log('BODY_START');
  console.log(bodyText.slice(0, 5000));
  console.log('INPUT_COUNT', await page.locator('input, textarea, select, button').count());
  console.log('LABEL_COUNT', await page.locator('label').count());
  const html = await page.content();
  console.log('HTML_HEAD');
  console.log(html.slice(0, 10000));
  await browser.close();
})();
