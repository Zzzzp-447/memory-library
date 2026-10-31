const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { createServer } = require('node:http')
const { chromium } = require('../node_modules/.pnpm/node_modules/playwright')
;(async () => {
 const remote = process.argv[2], base = remote || 'http://127.0.0.1:5193', root = path.resolve('cloudflare-pages/dist')
 const server = remote ? null : createServer((request, response) => {
   let pathname = new URL(request.url, base).pathname
   if (pathname === '/create' || pathname === '/library' || pathname.startsWith('/subjects/')) pathname = '/index.html'
   const file = path.resolve(root, '.' + pathname)
   if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); return response.end() }
   response.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream' }); response.end(fs.readFileSync(file))
 })
 if (server) await new Promise(resolve => server.listen(5193, '127.0.0.1', resolve))
 const proxyUrl = remote && (process.env.HTTPS_PROXY || process.env.HTTP_PROXY), proxy = proxyUrl ? new URL(proxyUrl) : null
 const browser = await chromium.launch({ channel: 'msedge', headless: true, ...(proxy ? { proxy: { server: proxy.origin, username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password) } } : { args: ['--no-proxy-server'] }) })
 try {
   for (const width of remote ? [390] : [1440, 390]) {
     const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 500, isMobile: width < 500, serviceWorkers: 'block' }), page = await context.newPage(), errors = []
     page.on('pageerror', error => errors.push(error.message))
     await page.goto(base + '/create?subject=math&chapter=limits', { waitUntil: 'domcontentloaded' }); await page.getByRole('heading', { name: 'Create Cards' }).waitFor()
     const bytes = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 500; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 500); x.fillStyle = '#000'; x.fillRect(40, 200, 300, 80); return c.toDataURL().split(',')[1] }), 'base64')
     const file = name => ({ name, mimeType: 'image/png', buffer: bytes })
     await page.getByLabel('批量导入题目图片').setInputFiles([file('saved.png'), file('cancelled.png')])
     await page.getByRole('button', { name: '开始制卡（1 张）', exact: true }).click()
     await page.getByRole('button', { name: '保存，制作下一张', exact: true }).click()
     await page.getByRole('button', { name: '开始制卡（1 张）', exact: true }).click()
     await page.getByLabel('本张卡片的导图补充内容').fill('这张取消，不应保存')
     const canvas = page.locator('canvas[aria-label="图片制卡编辑区，拖动涂抹答案或框选题目"]'); await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox()
     await page.mouse.move(box.x + box.width * .1, box.y + box.height * .45); await page.mouse.down(); await page.mouse.move(box.x + box.width * .6, box.y + box.height * .45, { steps: 5 }); await page.mouse.up()
     const cancel = page.getByRole('button', { name: '取消制卡', exact: true }); await cancel.scrollIntoViewIfNeeded()
     fs.mkdirSync('output/playwright', { recursive: true }); await page.screenshot({ path: `output/playwright/cancel-create-${remote ? 'live' : width}.png`, fullPage: false })
     if (width < 500) await cancel.tap(); else await cancel.click()
     await page.waitForURL(base + '/subjects/math/chapters/limits'); await page.getByAltText('第 1 张题目卡片').waitFor()
     assert.equal(await page.locator('.memory-tile').count(), 1)
     await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByAltText('第 1 张题目卡片').waitFor(); assert.equal(await page.locator('.memory-tile').count(), 1)
     await page.goto(base + '/create?subject=math&chapter=limits', { waitUntil: 'domcontentloaded' }); await page.getByLabel('批量导入题目图片').setInputFiles(file('region-cancel.png'))
     const regionCancel = page.getByRole('button', { name: '取消制卡', exact: true }); await regionCancel.scrollIntoViewIfNeeded(); if (width < 500) await regionCancel.tap(); else await regionCancel.click()
     await page.waitForURL(base + '/subjects/math/chapters/limits'); await page.getByAltText('第 1 张题目卡片').waitFor(); assert.equal(await page.locator('.memory-tile').count(), 1)
     assert.deepEqual(errors, []); console.log(`PASS ${remote ? 'live' : width}: cancel by ${width < 500 ? 'touch' : 'click'} exits editing and region selection; unsaved card discarded; saved card retained after reload`)
     await context.close()
   }
 } finally { await browser.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) } }
})().catch(error => { console.error(error); process.exitCode = 1 })
