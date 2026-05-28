const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Simple Static File Server ─────────────────────────────────────────
const PORT = 3009;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // Normalize request url
  let filePath = path.join(PUBLIC_DIR, req.url.split('?')[0]);
  if (filePath === PUBLIC_DIR || filePath.endsWith(path.sep)) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
server.listen(PORT, '127.0.0.1', async () => {
  console.log(`Local server running at http://127.0.0.1:${PORT}/`);

  // ── Find Chrome Path ────────────────────────────────────────────────
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

  try {
    const runTest = async (testName, actionFn, verifyFn) => {
      console.log(`\n=== Running Test: ${testName} ===`);
      const page = await browser.newPage();
      
      // Request failures
      page.on('requestfailed', request => {
        console.log(`[REQUEST FAILED]: ${request.url()} - ${request.failure().errorText}`);
      });

      // Response status checking
      page.on('response', response => {
        if (response.status() >= 400) {
          console.log(`[HTTP ERROR ${response.status()}]: ${response.url()}`);
        }
      });

      // Console logging from page
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log(`[CONSOLE ERROR]:`, msg.text());
        }
      });
      page.on('pageerror', err => {
        console.error(`[PAGE EXCEPTION]:`, err.stack);
      });

      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 15000 });
      console.log('Page loaded. Waiting 7 seconds for load sequence to finish...');
      await new Promise(r => setTimeout(r, 7000));

      // Capture initial state
      const menuDisplayBefore = await page.evaluate(() => {
        const mm = document.getElementById('main-menu');
        return mm ? window.getComputedStyle(mm).display : 'null';
      });
      console.log(`Main menu display before action: ${menuDisplayBefore}`);

      // Perform the custom action
      await actionFn(page);
      await new Promise(r => setTimeout(r, 2000));

      // Verify the result
      await verifyFn(page);

      // Save screenshot
      const imgPath = path.join(PUBLIC_DIR, `local_click_${testName.toLowerCase().replace(/\s+/g, '_')}.png`);
      await page.screenshot({ path: imgPath });
      console.log(`Screenshot saved to ${imgPath}`);

      await page.close();
    };

    // 1. Play Button Test
    await runTest('Play Button', async (page) => {
      console.log('Clicking Play...');
      await page.evaluate(() => {
        const el = document.getElementById('btn-play');
        if (el) el.click();
        else console.error('Play button not found in DOM!');
      });
    }, async (page) => {
      const { menuDisplay, menuHidden, hudHidden } = await page.evaluate(() => {
        const mm = document.getElementById('main-menu');
        const hud = document.getElementById('hud');
        return {
          menuDisplay: mm ? window.getComputedStyle(mm).display : 'null',
          menuHidden: mm ? mm.classList.contains('hidden') : null,
          hudHidden: hud ? hud.classList.contains('hidden') : null,
        };
      });
      console.log(`Main Menu - display: ${menuDisplay}, contains 'hidden' class: ${menuHidden}`);
      console.log(`HUD - contains 'hidden' class: ${hudHidden}`);
    });

    // 2. Characters Button Test
    await runTest('Characters Button', async (page) => {
      console.log('Clicking Characters...');
      await page.evaluate(() => {
        const el = document.getElementById('btn-characters');
        if (el) el.click();
        else console.error('Characters button not found in DOM!');
      });
    }, async (page) => {
      const { menuDisplay, charSelectDisplay } = await page.evaluate(() => {
        const mm = document.getElementById('main-menu');
        const cs = document.getElementById('char-select-screen');
        return {
          menuDisplay: mm ? window.getComputedStyle(mm).display : 'null',
          charSelectDisplay: cs ? window.getComputedStyle(cs).display : 'null',
        };
      });
      console.log(`Main Menu - display: ${menuDisplay}`);
      console.log(`Character Select Screen - display: ${charSelectDisplay}`);
    });

    // 3. Settings Button Test
    await runTest('Settings Button', async (page) => {
      console.log('Clicking Settings...');
      await page.evaluate(() => {
        const el = document.getElementById('btn-settings');
        if (el) el.click();
        else console.error('Settings button not found in DOM!');
      });
    }, async (page) => {
      const { menuDisplay, settingsDisplay } = await page.evaluate(() => {
        const mm = document.getElementById('main-menu');
        const ss = document.getElementById('settings-screen');
        return {
          menuDisplay: mm ? window.getComputedStyle(mm).display : 'null',
          settingsDisplay: ss ? window.getComputedStyle(ss).display : 'null',
        };
      });
      console.log(`Main Menu - display: ${menuDisplay}`);
      console.log(`Settings Screen - display: ${settingsDisplay}`);
    });

  } catch (err) {
    console.error('Unhandled error in tests:', err);
  } finally {
    console.log('\nShutting down browser and server...');
    await browser.close();
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  }
});
