param([switch]$BuildWeb)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $PSScriptRoot 'tooling'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed ($LASTEXITCODE)" }
}

if ($BuildWeb) {
    Push-Location $project
    try {
        Invoke-Checked 'node' @('node_modules/typescript/bin/tsc', '-b')
        Invoke-Checked 'node' @('node_modules/vite/bin/vite.js', 'build')
    } finally { Pop-Location }
}
if (!(Test-Path (Join-Path $project 'dist/index.html'))) { throw 'Build the web app first.' }

# Portable official tools remain inside this project; no system PATH changes.
foreach ($archive in @('jdk', 'platform', 'build-tools')) {
    $destination = Join-Path $tools $archive
    if (!(Test-Path $destination)) {
        New-Item -ItemType Directory -Path $destination | Out-Null
        Invoke-Checked 'tar.exe' @('-xf', (Join-Path $tools "$archive.zip"), '-C', $destination)
    }
}
$jdk = (Get-ChildItem (Join-Path $tools 'jdk') -Directory | Select-Object -First 1).FullName
$sdk = Join-Path $tools 'platform/android-35/android.jar'
$buildTools = Join-Path $tools 'build-tools/android-15'
$java = Join-Path $jdk 'bin/java.exe'
$workRelative = 'build/' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$work = Join-Path $PSScriptRoot $workRelative
$null = New-Item -ItemType Directory -Force -Path "$work/classes", "$work/dex", "$work/assets/web", "$PSScriptRoot/keys", "$PSScriptRoot/releases"
Copy-Item -Path "$project/dist/*" -Destination "$work/assets/web" -Recurse
Copy-Item -LiteralPath "$project/LICENSE" -Destination "$work/assets/UPSTREAM-LICENSE.txt"

$sources = @(Get-ChildItem (Join-Path $PSScriptRoot 'src') -Filter '*.java' -Recurse | ForEach-Object { $_.FullName })
Invoke-Checked (Join-Path $jdk 'bin/javac.exe') (@('-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', $sdk, '-d', "$work/classes") + $sources)
$classes = @(Get-ChildItem "$work/classes" -Filter '*.class' -Recurse | ForEach-Object { $_.FullName })
Invoke-Checked $java (@('-cp', "$buildTools/lib/d8.jar", 'com.android.tools.r8.D8', '--lib', $sdk, '--min-api', '26', '--output', "$work/dex") + $classes)
# aapt2 on Windows does not reliably accept non-ASCII absolute argument paths.
# All its inputs are relative to this module, including in the Chinese workspace.
Push-Location $PSScriptRoot
try {
    Invoke-Checked "$buildTools/aapt2.exe" @('compile', '--dir', 'res', '-o', "$workRelative/resources.zip")
    Invoke-Checked "$buildTools/aapt2.exe" @('link', '-I', 'tooling/platform/android-35/android.jar', '--manifest', 'AndroidManifest.xml', '--min-sdk-version', '26', '--target-sdk-version', '34', '--version-code', '13', '--version-name', '0.2.2-test', '-o', "$workRelative/unsigned.apk", '-R', "$workRelative/resources.zip")
} finally { Pop-Location }
# jar writes portable slash-separated entry names; aapt2 -A on Windows can
# produce backslashes, which Android's AssetManager cannot resolve.
Invoke-Checked (Join-Path $jdk 'bin/jar.exe') @('uf', "$work/unsigned.apk", '-C', "$work/dex", 'classes.dex', '-C', $work, 'assets')
Push-Location $PSScriptRoot
try { Invoke-Checked "$buildTools/zipalign.exe" @('-f', '-p', '4', "$workRelative/unsigned.apk", "$workRelative/aligned.apk") }
finally { Pop-Location }
$keystore = Join-Path $PSScriptRoot 'keys/local-test.keystore'
if (!(Test-Path $keystore)) {
    Invoke-Checked (Join-Path $jdk 'bin/keytool.exe') @('-genkeypair', '-keystore', $keystore, '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey', '-dname', 'CN=Memory Library Local Test,O=Local Development,C=CN', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000')
}
$apk = Join-Path $PSScriptRoot 'releases/MemoryLibrary-0.2.2-test.apk'
Invoke-Checked $java @('-jar', "$buildTools/lib/apksigner.jar", 'sign', '--ks', $keystore, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', $apk, "$work/aligned.apk")
Invoke-Checked $java @('-jar', "$buildTools/lib/apksigner.jar", 'verify', '--verbose', $apk)
Push-Location $PSScriptRoot
try {
    Invoke-Checked "$buildTools/zipalign.exe" @('-c', '4', 'releases/MemoryLibrary-0.2.2-test.apk')
    Invoke-Checked "$buildTools/aapt2.exe" @('dump', 'badging', 'releases/MemoryLibrary-0.2.2-test.apk')
} finally { Pop-Location }
Push-Location $project
try { Invoke-Checked 'node' @('scripts/check-android-package.cjs') }
finally { Pop-Location }
Get-FileHash -Algorithm SHA256 -LiteralPath $apk
Get-Item -LiteralPath $apk | Select-Object FullName, Length
