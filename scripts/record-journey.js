const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:5174';
const FRAMES_DIR = '/tmp/journey-frames';
const OUTPUT_VIDEO = path.join(__dirname, '..', 'docs', 'ux', 'journey1.mp4');

const USER_EMAIL = 'demo.user@instacover.test';
const USER_PASSWORD = 'DemoPass123!';

const BOOK_DATA = {
  title: 'The Midnight Garden',
  author: 'Eleanor Whitmore',
  coverIdeas: 'Moonlit garden with glowing flowers, mysterious silhouette, dark fantasy atmosphere, silver moonlight',
};

let frameCount = 0;
let isRecording = false;
let recordingInterval = null;
let page = null;

function weightedRandomDelay() {
  const r = Math.random();
  if (r < 0.5) return 30 + Math.random() * 30;
  if (r < 0.8) return 60 + Math.random() * 40;
  if (r < 0.93) return 100 + Math.random() * 50;
  return 150 + Math.random() * 100;
}

async function humanType(selector, text) {
  await page.click(selector);
  await sleep(100);
  
  for (const char of text) {
    await page.keyboard.type(char, { delay: 0 });
    await sleep(weightedRandomDelay());
  }
}

async function humanTypeIntoFocused(text) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 0 });
    await sleep(weightedRandomDelay());
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startRecording() {
  if (isRecording) return;
  isRecording = true;
  
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true });
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  
  frameCount = 0;
  
  const captureFrame = async () => {
    if (!isRecording) return;
    try {
      const framePath = path.join(FRAMES_DIR, `frame_${String(frameCount).padStart(6, '0')}.png`);
      await page.screenshot({ path: framePath });
      frameCount++;
    } catch (e) {
      console.log('Frame capture error:', e.message);
    }
    if (isRecording) {
      setTimeout(captureFrame, 1000 / 15);
    }
  };
  
  captureFrame();
  console.log('Recording started (15fps)...');
}

async function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  
  await sleep(500);
  console.log(`Recording stopped. ${frameCount} frames captured.`);
}

async function createVideo(speedupRanges) {
  console.log('Creating video with ffmpeg...');
  
  const processedDir = '/tmp/journey-processed';
  if (fs.existsSync(processedDir)) {
    fs.rmSync(processedDir, { recursive: true });
  }
  fs.mkdirSync(processedDir, { recursive: true });
  
  const files = fs.readdirSync(FRAMES_DIR).filter(f => f.endsWith('.png')).sort();
  let outputIndex = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const src = path.join(FRAMES_DIR, file);
    
    let speedup = 1;
    for (const range of speedupRanges) {
      if (i >= range.start && i < range.end) {
        speedup = range.factor;
        break;
      }
    }
    
    if (speedup === 1 || i % speedup === 0) {
      const dst = path.join(processedDir, `frame_${String(outputIndex).padStart(6, '0')}.png`);
      fs.copyFileSync(src, dst);
      outputIndex++;
    }
  }
  
  console.log(`Processed ${outputIndex} frames for final video`);
  
  const ffmpegCmd = `ffmpeg -y -framerate 15 -i "${processedDir}/frame_%06d.png" -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -movflags +faststart "${OUTPUT_VIDEO}"`;
  
  console.log('Running ffmpeg...');
  execSync(ffmpegCmd, { stdio: 'inherit' });
  
  fs.rmSync(FRAMES_DIR, { recursive: true });
  fs.rmSync(processedDir, { recursive: true });
  
  const stats = fs.statSync(OUTPUT_VIDEO);
  console.log(`Video created: ${OUTPUT_VIDEO} (${Math.round(stats.size / 1024 / 1024 * 10) / 10} MB)`);
}

async function fullRecording() {
  console.log('\n=== FULL RECORDING ===\n');
  
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await sleep(500);
  
  await startRecording();
  
  console.log('Recording: Home page (2s pause)');
  await sleep(2000);
  
  console.log('Recording: Click Start Creating');
  const startBtn = await page.$('a:has-text("Start Creating")');
  if (startBtn) {
    await sleep(300);
    await startBtn.click();
  } else {
    await page.goto(`${BASE_URL}/login`);
  }
  await page.waitForLoadState('networkidle');
  await sleep(1200);
  
  console.log('Recording: Type email');
  await humanType('input[type="email"]', USER_EMAIL);
  await sleep(300);
  
  console.log('Recording: Type password');
  await humanType('input[type="password"]', USER_PASSWORD);
  await sleep(400);
  
  console.log('Recording: Submit login');
  await page.click('button[type="submit"]');
  
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (page.url().includes('/generate')) break;
  }
  await sleep(1500);
  
  console.log('Recording: Type book title');
  await humanType('input[placeholder="Your book title"]', BOOK_DATA.title);
  await sleep(400);
  
  console.log('Recording: Type author name');
  await humanType('input[placeholder="Author name"]', BOOK_DATA.author);
  await sleep(400);
  
  console.log('Recording: Type cover ideas');
  const coverIdeasTextarea = await page.$('textarea');
  if (coverIdeasTextarea) {
    await coverIdeasTextarea.click();
    await sleep(150);
    await humanTypeIntoFocused(BOOK_DATA.coverIdeas);
  }
  await sleep(500);
  
  console.log('Recording: Select style reference (The Great Gatsby)');
  const selects = await page.$$('select');
  if (selects.length >= 2) {
    await selects[1].focus();
    await sleep(200);
    await selects[1].selectOption({ label: 'The Great Gatsby - F. Scott Fitzgerald' });
  }
  await sleep(800);
  
  console.log('Recording: Wait for button to be ready...');
  await page.waitForFunction(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.textContent.includes('Generate') && btn.textContent.includes('credits') && !btn.disabled) {
        return true;
      }
    }
    return false;
  }, { timeout: 15000 });
  
  const generationStartFrame = frameCount;
  console.log(`Recording: Click Generate (frame ${generationStartFrame})`);
  
  const generateBtn = await page.evaluateHandle(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.textContent.includes('Generate') && btn.textContent.includes('credits')) {
        return btn;
      }
    }
    return null;
  });
  
  if (generateBtn) {
    await generateBtn.click();
    console.log('  Generate button clicked');
  }
  
  await sleep(1000);
  
  console.log('Recording: Waiting for generation...');
  let generationEndFrame = frameCount;
  let coverImageFound = false;
  
  for (let i = 0; i < 180; i++) {
    await sleep(1000);
    
    const pageState = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const isGenerating = bodyText.includes('Creating your cover') || 
                          bodyText.includes('Generating') ||
                          bodyText.includes('Cancel generation');
      
      const imgs = document.querySelectorAll('img');
      let hasCoverImg = false;
      for (const img of imgs) {
        if (img.src && img.src.includes('supabase') && 
            img.naturalWidth > 200 && img.naturalHeight > 200) {
          hasCoverImg = true;
          break;
        }
      }
      
      const hasGenerateBtn = Array.from(document.querySelectorAll('button'))
        .some(btn => btn.textContent.includes('Generate') && btn.textContent.includes('credits') && !btn.disabled);
      
      return { isGenerating, hasCoverImg, hasGenerateBtn };
    });
    
    if (pageState.hasCoverImg && !pageState.isGenerating && pageState.hasGenerateBtn) {
      generationEndFrame = frameCount;
      coverImageFound = true;
      console.log(`  Cover image found at frame ${generationEndFrame} (${i}s)`);
      break;
    }
    
    if (i % 15 === 0) {
      console.log(`  ${i}s: generating=${pageState.isGenerating}, hasCover=${pageState.hasCoverImg}`);
    }
  }
  
  if (!coverImageFound) {
    console.log('  Warning: Cover image not detected, checking for result anyway...');
    generationEndFrame = frameCount;
  }
  
  console.log('Recording: Show result (3s pause)');
  await sleep(3000);
  
  await stopRecording();
  
  const generationDuration = generationEndFrame - generationStartFrame;
  let speedupRanges = [];
  
  if (generationDuration > 300) {
    speedupRanges = [
      { start: generationStartFrame + 60, end: generationEndFrame - 90, factor: 6 }
    ];
  }
  
  console.log(`Generation duration: ${generationDuration} frames`);
  console.log(`Speedup ranges: ${JSON.stringify(speedupRanges)}`);
  await createVideo(speedupRanges);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  
  page = await context.newPage();
  
  try {
    await fullRecording();
  } catch (error) {
    console.error('Error:', error);
    await stopRecording();
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
