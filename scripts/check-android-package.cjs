// Run after android-test/build.ps1. Verify the APK contains the current app,
// not an earlier build or an empty wrapper pointing at a desktop dev server.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const JSZip = require('jszip')

;(async () => {
  const apk = 'android-test/releases/MemoryLibrary-0.2.3-test.apk'
  const bytes = fs.readFileSync(apk)
  const zip = await JSZip.loadAsync(bytes)
  for (const name of ['AndroidManifest.xml', 'classes.dex', 'resources.arsc', 'assets/web/index.html'])
    assert.ok(zip.file(name), `${name} must be packaged`)
  const dex = await zip.file('classes.dex').async('nodebuffer')
  assert.ok(dex.subarray(0, 4).equals(Buffer.from('dex\n')))
  assert.ok(dex.includes(Buffer.from('Lcom/memorylibrary/study/ReminderReceiver;')), 'Native alarm receiver must be in the APK')
  assert.ok(zip.file('res/drawable/notification_cards.xml'), 'Notification needs a monochrome small icon')
  const manifest = await zip.file('AndroidManifest.xml').async('nodebuffer')
  const hasText = text => manifest.includes(Buffer.from(text)) || manifest.includes(Buffer.from(text, 'utf16le'))
  for (const value of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'ReminderReceiver', 'BOOT_COMPLETED', 'TIMEZONE_CHANGED', 'MY_PACKAGE_REPLACED'])
    assert.ok(hasText(value), `Manifest must declare ${value}`)
  assert.equal(hasText('SCHEDULE_EXACT_ALARM'), false, 'Daily approximate reminders do not require exact-alarm access')
  assert.ok(zip.file('res/drawable/app_icon_selected.png'), 'Selected red folder icon must be packaged')
  assert.ok(zip.file('assets/web/textbooks/catalog.json'), 'Textbook catalog must be offline available')
  let count = 0
  async function compare(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const local = path.join(directory, entry.name)
      if (entry.isDirectory()) { await compare(local); continue }
      const name = 'assets/web/' + path.relative('dist', local).split(path.sep).join('/')
      assert.ok(zip.file(name), `${name} is missing`)
      assert.ok(fs.readFileSync(local).equals(await zip.file(name).async('nodebuffer')), `${name} is stale`)
      count++
    }
  }
  await compare('dist')
  assert.equal(Object.keys(zip.files).filter(name => name.startsWith('lib/')).length, 0)
  const report = { result: 'PASS', apk: path.basename(apk), bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bundledWebFiles: count,
    nativeCpuLibraries: 0, signing: 'APK v2 and v3 verified by apksigner during build',
    physicalDevice: 'Pending user testing in 卓易通; not tested on a physical device' }
  fs.writeFileSync('android-test/releases/verification.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch(error => { console.error(error); process.exitCode = 1 })
