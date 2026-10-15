#!/usr/bin/env node
import readline from 'readline';
import { chromium } from 'playwright';
import { loadConfig } from './src/config/index.js';
import { extractSingleSlideFromFrame, extractSubtopicSlides } from './src/course/extractSlides.js';
import { computeCombinedSimilarity, computeDiceSimilarity } from './src/comparison/compare.js';
import { normalizeText, extractNumericValues } from './src/comparison/normalize.js';
import fs from 'fs';
import path from 'path';

/**
 * Helper to prompt user in terminal
 */
function askPrompt(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

/**
 * Click Next button or detect MCQ on a page
 */
async function tryAdvanceSlide(page, sideLabel) {
  const nextSelectors = [
    "button[aria-label*='next' i]:not([disabled])",
    "a[aria-label*='next' i]:not(.disabled)",
    ".next-slide:not(.disabled):not([disabled])",
    ".btn-next:not(.disabled):not([disabled])",
    "button:has-text('Next'):not([disabled])",
    "a:has-text('Next'):not(.disabled)",
    "[data-action='next']:not([disabled])"
  ];

  // Check if Next button exists and is active
  for (const selector of nextSelectors) {
    try {
      const btn = page.locator(selector).first();
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.click({ timeout: 4000 });
        await page.waitForTimeout(1500);
        return { advanced: true, locked: false };
      }
    } catch {
      // try next selector
    }
  }

  // Check if there is an interactive MCQ or locked next button
  const isQuizLocked = await page
    .evaluate(() => {
      const hasQuiz = Boolean(
        document.querySelector(
          'input[type="radio"], input[type="checkbox"], [role="radio"], [class*="quiz" i], [class*="mcq" i], [class*="question" i], [class*="matching" i], button:has-text("Submit"), button:has-text("Check")'
        )
      );
      const hasDisabledNext = Boolean(
        document.querySelector(
          "button[aria-label*='next' i][disabled], a[aria-label*='next' i].disabled, button:has-text('Next')[disabled]"
        )
      );
      return hasQuiz || hasDisabledNext;
    })
    .catch(() => false);

  return { advanced: false, locked: isQuizLocked };
}

async function main() {
  const config = loadConfig();
  const legacyUrl = config.sourceUrl || process.env.SOURCE_URL || 'https://learn.adbanker.com';
  const newUrl = config.courseUrl || process.env.COURSE_URL || 'https://adbanker-staging.myshuttle.io';

  console.log('\n========================================================================');
  console.log('   👀 LIVE SIDE-BY-SIDE COURSE VIEWER & COMPARATOR (DUAL SCREEN)');
  console.log('========================================================================');
  console.log(`👈 LEFT WINDOW  : Legacy Course  -> ${legacyUrl}`);
  console.log(`👉 RIGHT WINDOW : New LMS Course -> ${newUrl}`);
  console.log('========================================================================\n');

  console.log('[1/4] Launching dual browser windows positioned side-by-side...');

  // Window 1: Left half of monitor (0 to 960px)
  const browserLeft = await chromium.launch({
    headless: false,
    args: ['--window-position=0,0', '--window-size=960,1040']
  });
  const contextLeft = await browserLeft.newContext({ viewport: { width: 940, height: 960 } });
  const pageLeft = await contextLeft.newPage();

  // Window 2: Right half of monitor (960 to 1920px)
  const browserRight = await chromium.launch({
    headless: false,
    args: ['--window-position=960,0', '--window-size=960,1040']
  });
  const contextRight = await browserRight.newContext({ viewport: { width: 940, height: 960 } });
  const pageRight = await contextRight.newPage();

  console.log('[2/4] Navigating both windows to course URLs...');
  await Promise.allSettled([
    pageLeft.goto(legacyUrl, { timeout: 60000, waitUntil: 'domcontentloaded' }),
    pageRight.goto(newUrl, { timeout: 60000, waitUntil: 'domcontentloaded' })
  ]);

  console.log('\n========================================================================');
  console.log('👉 Both browser windows are now open on your screen:');
  console.log('   - Left screen:  Legacy System');
  console.log('   - Right screen: New System');
  console.log('');
  console.log('If you need to log in or navigate to Chapter 1, do so now in the windows.');
  console.log('========================================================================\n');

  await askPrompt('Press [ENTER] when both courses are visible and ready on screen to begin live sync...');

  console.log('\n[3/4] Live Synchronized Audit Started!');
  console.log('Commands:');
  console.log('  - Press [ENTER] to advance both slides simultaneously');
  console.log('  - Type "auto" to automatically advance every 4 seconds');
  console.log('  - Type "q" to stop and save live audit log\n');

  let slideIndex = 1;
  let autoMode = process.argv.includes('--auto');
  const auditLogs = [];

  while (true) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`📍 AUDITING SLIDE #${slideIndex} (Side-by-Side)`);
    console.log(`------------------------------------------------------------------------`);

    // Extract content from Left Window (Legacy)
    const leftData = await extractSingleSlideFromFrame(
      pageLeft.mainFrame(),
      { moduleName: 'Legacy Course', subtopicName: `Slide ${slideIndex}`, sequentialSlideNumber: slideIndex },
      config
    ).catch(() => ({ slideTitle: 'Left Page', meaningfulText: '' }));

    // Extract content from Right Window (New System)
    const rightData = await extractSingleSlideFromFrame(
      pageRight.mainFrame(),
      { moduleName: 'New Course', subtopicName: `Slide ${slideIndex}`, sequentialSlideNumber: slideIndex },
      config
    ).catch(() => ({ slideTitle: 'Right Page', meaningfulText: '' }));

    const leftTitle = leftData.slideTitle || 'N/A';
    const rightTitle = rightData.slideTitle || 'N/A';
    const leftText = leftData.meaningfulText || '';
    const rightText = rightData.meaningfulText || '';

    // Calculate real-time similarity
    const sim = computeCombinedSimilarity(leftText, rightText);
    const simPct = (sim * 100).toFixed(0);

    // Check for number/factual differences
    const leftNums = extractNumericValues(leftText);
    const rightNums = extractNumericValues(rightText);
    const numDiffs = leftNums.filter((n) => !rightNums.includes(n));

    console.log(`👈 Legacy (Left):  "${leftTitle}" (${leftText.length} chars)`);
    console.log(`👉 New LMS (Right): "${rightTitle}" (${rightText.length} chars)`);

    let statusLabel = '✅ EXACT / HIGH MATCH';
    if (sim < 0.6) {
      statusLabel = '⚠️ CONTENT DIFFERENCE';
    } else if (leftTitle.toLowerCase() !== rightTitle.toLowerCase()) {
      statusLabel = 'ℹ️ MATCHED (Renamed Topic)';
    }

    console.log(`📊 Alignment: ${statusLabel} (${simPct}% content match)`);

    if (numDiffs.length > 0) {
      console.log(`⚠️ Number mismatch detected! Legacy has "${numDiffs.join(', ')}" not found on Right.`);
    }

    auditLogs.push({
      slide: slideIndex,
      leftTitle,
      rightTitle,
      similarity: simPct,
      status: statusLabel,
      timestamp: new Date().toLocaleTimeString()
    });

    // Check user input or auto advance
    if (!autoMode) {
      const input = await askPrompt('\n👉 Press [ENTER] to advance (or type "auto" / "q"): ');
      if (input.toLowerCase() === 'q') break;
      if (input.toLowerCase() === 'auto') {
        autoMode = true;
        console.log('⏩ Auto-advance mode enabled (4 seconds per slide)...');
      }
    } else {
      await new Promise((r) => setTimeout(r, 4000));
    }

    // Advance Left Window
    const leftResult = await tryAdvanceSlide(pageLeft, 'Legacy');
    // Advance Right Window
    const rightResult = await tryAdvanceSlide(pageRight, 'New LMS');

    // Handle interactive MCQ or locked slide
    if (rightResult.locked || leftResult.locked) {
      console.log('\n  ⚠️  [INTERACTIVE QUIZ / MCQ / LOCKED NEXT BUTTON]');
      console.log('     Please answer the question or match-the-following in the open browser.');
      await askPrompt('     Press [ENTER] once you have completed the quiz on screen to resume...');
      await tryAdvanceSlide(pageLeft, 'Legacy');
      await tryAdvanceSlide(pageRight, 'New LMS');
    }

    slideIndex += 1;
  }

  // Save live audit summary
  const reportPath = path.join(config.paths.reportsDir, 'live-audit-summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditLogs, null, 2), 'utf-8');
  console.log(`\n[Done] Live audit ended. Summary saved to: ${reportPath}`);

  await browserLeft.close().catch(() => {});
  await browserRight.close().catch(() => {});
}

main().catch((err) => {
  console.error('[Error in live compare]:', err);
});
