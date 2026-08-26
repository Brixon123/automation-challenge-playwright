/**
 * index.js
 * Playwright automation script to:
 *  - Read rows from an Excel/CSV file (xlsx/csv)
 *  - Log in to the site (credentials provided via env)
 *  - For each row, dynamically locate inputs based on column headers and fill them
 *  - Submit the form and handle dynamic field re-layout after each submit
 *  - Detect reCAPTCHA and optionally integrate with 2captcha
 *
 * Usage:
 *  - Configure .env or environment variables:
 *      EXCEL_FILE=./data/challenge1.csv
 *      USERNAME=your_login_user
 *      PASSWORD=your_login_pass
 *      HEADLESS=true
 *      TWOCAPTCHA_APIKEY= (optional)
 *
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const axios = require('axios');
const { chromium } = require('playwright');
require('dotenv').config();

const EXCEL_FILE = process.env.EXCEL_FILE || './data/challenge1.csv';
const SITE_URL = 'https://www.theautomationchallenge.com/';
const USERNAME = process.env.USERNAME || '';
const PASSWORD = process.env.PASSWORD || '';
const HEADLESS = (process.env.HEADLESS || 'true') === 'true';
const TWOCAPTCHA_APIKEY = process.env.TWOCAPTCHA_APIKEY || '';

function readExcel(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
    // Use xlsx to read CSV/TSV as a sheet
    const workbook = xlsx.readFile(filePath, { raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    return rows;
  }
  // default: try XLSX
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  return rows;
}

async function findFieldLocator(page, labelText) {
  const labelTextNorm = labelText.toString().trim();
  const labelLoc = page.locator(`label:has-text("${labelTextNorm}")`).first();
  if (await labelLoc.count() > 0) {
    const forAttr = await labelLoc.getAttribute('for');
    if (forAttr) {
      const inputById = page.locator(`#${CSSescape(forAttr)}`);
      if (await inputById.count() > 0) return inputById;
    }
    const afterInput = page.locator(`xpath=//label[contains(normalize-space(.),"${escapeXpathText(labelTextNorm)}")]/following::input[1]`);
    if (await afterInput.count() > 0) return afterInput;
    const afterTextarea = page.locator(`xpath=//label[contains(normalize-space(.),"${escapeXpathText(labelTextNorm)}")]/following::textarea[1]`);
    if (await afterTextarea.count() > 0) return afterTextarea;
    const afterSelect = page.locator(`xpath=//label[contains(normalize-space(.),"${escapeXpathText(labelTextNorm)}")]/following::select[1]`);
    if (await afterSelect.count() > 0) return afterSelect;
  }

  const byPlaceholder = page.locator(`input[placeholder*="${labelTextNorm}"], textarea[placeholder*="${labelTextNorm}"]`).first();
  if (await byPlaceholder.count() > 0) return byPlaceholder;

  const byAria = page.locator(`[aria-label*="${labelTextNorm}"]`).first();
  if (await byAria.count() > 0) return byAria;

  const nearTextInput = page.locator(`xpath=//*/text()[contains(normalize-space(.),"${escapeXpathText(labelTextNorm)}")]/parent::*/following::input[1]`);
  if (await nearTextInput.count() > 0) return nearTextInput;

  const byName = page.locator(`input[name*="${labelTextNorm}"], textarea[name*="${labelTextNorm}"], select[name*="${labelTextNorm}"]`).first();
  if (await byName.count() > 0) return byName;

  return null;
}

async function fillField(fieldLocator, value, page) {
  const tagName = await fieldLocator.evaluate(el => el.tagName && el.tagName.toLowerCase());
  if (!tagName) return false;
  value = value === null || value === undefined ? '' : String(value);
  if (tagName === 'select') {
    try {
      await fieldLocator.selectOption({ value });
      return true;
    } catch (e) {
      await fieldLocator.selectOption({ label: value }).catch(() => {});
      return true;
    }
  }
  if (tagName === 'input') {
    const type = await fieldLocator.evaluate(el => el.getAttribute('type') || 'text');
    if (['checkbox', 'radio'].includes(type)) {
      const shouldCheck = ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
      const isChecked = await fieldLocator.isChecked().catch(() => false);
      if (shouldCheck !== isChecked) {
        await fieldLocator.click({ force: true });
      }
      return true;
    } else {
      await fieldLocator.fill('');
      await fieldLocator.type(value, { delay: 10 });
      return true;
    }
  }
  if (tagName === 'textarea') {
    await fieldLocator.fill('');
    await fieldLocator.type(value, { delay: 10 });
    return true;
  }
  const isContentEditable = await fieldLocator.evaluate(el => el.isContentEditable).catch(() => false);
  if (isContentEditable) {
    await fieldLocator.fill ? fieldLocator.fill(value) : fieldLocator.evaluate((el, v) => el.innerText = v, value);
    return true;
  }
  await fieldLocator.click({ force: true }).catch(() => {});
  await page.keyboard.insertText(value);
  return true;
}

async function detectRecaptcha(page) {
  const frames = page.frames();
  for (const f of frames) {
    const title = await f.title().catch(() => '');
    if ((title || '').toLowerCase().includes('recaptcha') || (f.url && f.url().includes('google.com/recaptcha'))) {
      return { present: true, frame: f };
    }
  }
  const grecaptchaDiv = page.locator('div.g-recaptcha, div[data-sitekey], iframe[src*="recaptcha"]');
  if (await grecaptchaDiv.count() > 0) {
    const sitekey = await grecaptchaDiv.first().getAttribute('data-sitekey');
    return { present: true, sitekey: sitekey || null };
  }
  return { present: false };
}

async function solveRecaptcha2Captcha(siteUrl, siteKey) {
  if (!TWOCAPTCHA_APIKEY) throw new Error('2captcha API key not configured (TWOCAPTCHA_APIKEY).');
  const submitUrl = `http://2captcha.com/in.php?key=${TWOCAPTCHA_APIKEY}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${encodeURIComponent(siteUrl)}&json=1`;
  const subRes = await axios.get(submitUrl, { timeout: 20000 });
  if (!subRes.data || subRes.data.status !== 1) throw new Error(`2captcha submit failed: ${JSON.stringify(subRes.data)}`);
  const requestId = subRes.data.request;
  const resultUrl = `http://2captcha.com/res.php?key=${TWOCAPTCHA_APIKEY}&action=get&id=${requestId}&json=1`;
  const maxAttempts = 24;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const rres = await axios.get(resultUrl).catch(() => null);
    if (!rres || !rres.data) continue;
    if (rres.data.status === 1) return rres.data.request;
    if (rres.data.request !== 'CAPCHA_NOT_READY') throw new Error(`2captcha error: ${JSON.stringify(rres.data)}`);
  }
  throw new Error('2captcha timed out waiting for solution');
}

function CSSescape(str) {
  return str.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1');
}

function escapeXpathText(text) {
  if (text.indexOf('"') === -1) {
    return text;
  }
  const parts = text.split('"').map(p => '"' + p + '"');
  return 'concat(' + parts.join(', '\'' + '"' + '\'', ') + ')';
}

(async () => {
  console.log('Reading file:', EXCEL_FILE);
  const rows = readExcel(EXCEL_FILE);
  console.log(`Rows read: ${rows.length}`);

  const browser = await chromium.launch({ headless: HEADLESS, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to site...');
  await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' });

  try {
    const userInput = page.locator('input[type="email"], input[type="text"][name*=user], input[name*=email]').first();
    const passInput = page.locator('input[type="password"]').first();

    if (await userInput.count() > 0 && await passInput.count() > 0) {
      console.log('Login form found on page — filling credentials.');
      await userInput.fill(USERNAME);
      await passInput.fill(PASSWORD);
      const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), input[type="submit"]').first();
      if (await submitBtn.count() > 0) {
        await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}), submitBtn.click()]);
      }
    } else {
      const loginLink = page.locator('text=Login, text=Sign In, text=Sign in').first();
      if (await loginLink.count() > 0) {
        await loginLink.click().catch(() => {});
        await page.waitForTimeout(1000);
        const u = page.locator('input[type="email"], input[type="text"][name*=user], input[name*=email]').first();
        const p = page.locator('input[type="password"]').first();
        if (await u.count() > 0 && await p.count() > 0) {
          await u.fill(USERNAME);
          await p.fill(PASSWORD);
          const sb = page.locator('button[type="submit"], button:has-text("Login"), input[type="submit"]').first();
          if (await sb.count() > 0) {
            await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}), sb.click()]);
          }
        }
      } else {
        console.log('No explicit login form/link found — assuming already logged in or site uses no-login for test.');
      }
    }
  } catch (e) {
    console.warn('Login step encountered an error, continuing:', e.message);
  }

  await page.waitForTimeout(1000);
  const startTime = Date.now();
  let rowIndex = 0;

  for (const row of rows) {
    rowIndex++;
    console.log(`Processing row ${rowIndex}/${rows.length}`);
    for (const colName of Object.keys(row)) {
      const value = row[colName];
      try {
        const field = await findFieldLocator(page, colName);
        if (field) {
          await fillField(field, value, page);
          await page.waitForTimeout(80);
        } else {
          console.warn(`Field not found for column "${colName}" — skipping.`);
        }
      } catch (err) {
        console.warn(`Error filling field "${colName}":`, err.message);
      }
    }

    const captcha = await detectRecaptcha(page);
    if (captcha.present) {
      console.log('reCAPTCHA detected on page.');
      if (TWOCAPTCHA_APIKEY && captcha.sitekey) {
        console.log('Attempting to solve reCAPTCHA via 2captcha...');
        try {
          const token = await solveRecaptcha2Captcha(SITE_URL, captcha.sitekey);
          await page.evaluate((t) => {
            let el = document.getElementById('g-recaptcha-response');
            if (!el) {
              el = document.createElement('textarea');
              el.id = 'g-recaptcha-response';
              el.style.display = 'none';
              document.body.appendChild(el);
            }
            el.value = t;
          }, token);
          console.log('Injected token. Continuing.');
        } catch (e) {
          console.error('2captcha solving failed:', e.message);
          console.log('Pausing and waiting 2 minutes for manual captcha solve...');
          await page.waitForTimeout(120000);
        }
      } else {
        console.log('No 2captcha API key provided — waiting up to 2 minutes for manual captcha solve.');
        await page.waitForTimeout(120000);
      }
    }

    const submitBtn = page.locator('button:has-text("Submit"), input[type="submit"], button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => {}),
        submitBtn.click({ timeout: 5000 }).catch(() => {})
      ]);
    } else {
      await page.keyboard.press('Enter').catch(() => {});
    }

    await page.waitForTimeout(600);
    await page.waitForLoadState('networkidle').catch(() => {});

    const elapsed = (Date.now() - startTime) / 1000;
    const estimatedRemaining = (rows.length - rowIndex) * 3;
    if (elapsed + estimatedRemaining > 240) {
      console.warn(`Approaching time limit. Elapsed ${elapsed.toFixed(1)}s. Consider increasing speed or running headless.`);
    }
  }

  console.log('All rows processed. Closing browser...');
  await browser.close();
  const total = (Date.now() - startTime) / 1000;
  console.log(`Completed in ${total.toFixed(1)} seconds.`);
  process.exit(0);
})().catch(err => {
  console.error('Fatal error in script:', err);
  process.exit(1);
});
