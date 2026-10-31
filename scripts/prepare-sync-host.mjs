import { cpSync, readFileSync, writeFileSync } from 'node:fs'
cpSync(new URL('../dist/',import.meta.url),new URL('../sync-cloud/public/',import.meta.url),{recursive:true})
writeFileSync(new URL('../sync-cloud/lib/study-shell.ts',import.meta.url),'export const studyShell = '+JSON.stringify(readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'))+';\n')
writeFileSync(new URL('../sync-cloud/lib/repair-page.ts',import.meta.url),'export const repairPage = '+JSON.stringify(readFileSync(new URL('../dist/repair.html',import.meta.url),'utf8'))+';\n')
console.log('Prepared hosted study frontend and textbook index')
