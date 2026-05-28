const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\HP\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
  ];
  let executablePath = null;
  for (const p of paths) {
    if (fs.existsSync(p)) {
      executablePath = p;
      break;
    }
  }
  
  if (!executablePath) executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  console.log('Using Chrome at:', executablePath);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const runClickTest = async (buttonId, screenshotName) => {
    const page = await browser.newPage();
    
    // Listen to console and errors
    page.on('console', msg => {
      console.log(`[CLICK ${buttonId}] [CONSOLE ${msg.type()}]:`, msg.text());
    });
    page.on('pageerror', err => {
      console.error(`[CLICK ${buttonId}] [ERROR]:`, err.stack);
    });

    console.log(`\n--- Testing click on #${buttonId} ---`);
    const fileUrl = 'file:///' + require('path').resolve('index.html').replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 6000)); // wait for load

    // Click the button
    try {
      console.log(`Clicking #${buttonId}...`);
      const interceptor = await page.evaluate((id) => {
        const chest = document.getElementById('chest-open-overlay');
        if (chest) {
          const style = window.getComputedStyle(chest);
          console.log('chest-open-overlay computed pointer-events:', style.pointerEvents, 'opacity:', style.opacity, 'display:', style.display, 'z-index:', style.zIndex);
        }
        
        const el = document.getElementById(id);
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const topEl = document.elementFromPoint(x, y);
        return topEl ? (topEl.id || topEl.className || topEl.tagName) : 'none';
      }, buttonId);
      console.log(`Element at #${buttonId} coordinates is: ${interceptor}`);
      
      await page.click(`#${buttonId}`);
      console.log(`Clicked #${buttonId}! Waiting 2 seconds...`);
      await new Promise(r => setTimeout(r, 2000));
      
      // Save screenshot
      await page.screenshot({ path: `screenshot_click_${screenshotName}.png` });
      console.log(`Screenshot saved to screenshot_click_${screenshotName}.png`);
    } catch (e) {
      console.error(`Failed to click #${buttonId}:`, e.message);
    }
    await page.close();
  };

  await runClickTest('btn-play', 'play');
  await runClickTest('btn-characters', 'characters');
  await runClickTest('btn-leaderboard', 'leaderboard');
  await runClickTest('btn-settings', 'settings');

  await browser.close();
})();
