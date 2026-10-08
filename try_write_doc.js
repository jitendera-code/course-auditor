import { chromium } from 'playwright';
import path from 'path';
import os from 'os';

async function main() {
  const docId = '1IHV7i6e9o1rydJ-j0viZFxu4AWj5SvKNHL9QjusIjDw';
  const url = `https://docs.google.com/document/d/${docId}/edit`;
  const textToWrite = 'i love food';

  console.log(`Navigating to Google Doc: ${url}`);

  // Try launching persistent context with user's Chrome data dir if possible, or standard chromium
  let browser;
  let page;

  try {
    // Standard launch
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const title = await page.title();
    console.log(`Document Title: ${title}`);

    // Check edit access
    const isViewOnly = await page.locator('text="Request edit access"').count() > 0 || await page.locator('text="View only"').count() > 0;
    console.log(`View Only Mode: ${isViewOnly}`);

    if (isViewOnly) {
      console.log('Document is view-only (not signed in or missing edit access).');
    } else {
      console.log('Document appears editable! Attempting to write text...');
      // Click on canvas / document body and type
      const canvas = page.locator('.kix-appview-editor').first();
      await canvas.click();
      await page.waitForTimeout(500);
      await page.keyboard.type(textToWrite);
      await page.waitForTimeout(2000);
      console.log('Successfully typed text into document!');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (browser) await browser.close();
  }
}

main();
