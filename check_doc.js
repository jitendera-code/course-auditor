import { chromium } from 'playwright';

async function checkDoc() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    console.log('Navigating to doc...');
    await page.goto('https://docs.google.com/document/d/1IHV7i6e9o1rydJ-j0viZFxu4AWj5SvKNHL9QjusIjDw/edit?usp=sharing', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    console.log('Title:', await page.title());
    
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Body snippet:', bodyText.substring(0, 300).replace(/\n/g, ' '));

    const isViewOnly = await page.locator('text="Request edit access"').count() > 0 || await page.locator('text="View only"').count() > 0;
    console.log('Is View Only:', isViewOnly);

    // Check if doc canvas/editor exists
    const editorCanvas = await page.locator('.kix-appview-editor, .docs-texthtml-iframe, canvas').count();
    console.log('Editor canvas elements found:', editorCanvas);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

checkDoc();
