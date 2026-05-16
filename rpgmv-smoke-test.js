const { chromium } = require("playwright");
const path = require("path");

const url = "http://127.0.0.1:8161/";
const outDir = __dirname;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sceneName(page) {
  return page.evaluate(() => {
    const scene = window.SceneManager && window.SceneManager._scene;
    return scene && scene.constructor ? scene.constructor.name : null;
  });
}

async function errorText(page) {
  return page.evaluate(() => {
    const printer = document.getElementById("ErrorPrinter");
    return printer ? printer.innerText.trim() : "";
  });
}

(async () => {
  const logs = [];
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage({ viewport: { width: 816, height: 624 } });

  page.on("console", (msg) => {
    logs.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (error) => {
    logs.push({ type: "pageerror", text: error.stack || error.message });
  });

  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => window.SceneManager && window.SceneManager._scene, null, {
    timeout: 30000,
  });
  await delay(2500);

  const titleScene = await sceneName(page);
  const titleError = await errorText(page);
  await page.screenshot({ path: path.join(outDir, "rpgmv-title.png") });

  await page.keyboard.press("Enter");
  await delay(4000);
  const afterEnterScene = await sceneName(page);
  const afterEnterError = await errorText(page);
  await page.screenshot({ path: path.join(outDir, "rpgmv-after-enter.png") });

  await page.keyboard.press("Enter");
  await delay(3000);
  const afterSecondEnterScene = await sceneName(page);
  const afterSecondEnterError = await errorText(page);
  await page.screenshot({ path: path.join(outDir, "rpgmv-after-second-enter.png") });

  await browser.close();

  console.log(JSON.stringify({
    titleScene,
    titleError,
    afterEnterScene,
    afterEnterError,
    afterSecondEnterScene,
    afterSecondEnterError,
    logs,
  }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
