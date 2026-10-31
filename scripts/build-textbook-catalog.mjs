import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const base = new URL('../../knowledge/ChinaTextbook-index/', import.meta.url)
const source=JSON.parse(readFileSync(new URL('source-catalog.json',base),'utf8').replace(/^\uFEFF/,''))
const verified=JSON.parse(readFileSync(new URL('verified-outlines.json',base),'utf8').replace(/^\uFEFF/,''))
const books=source.books.map(book=>{
 const parts=book.parts.some(p=>!p.part)?book.parts.filter(p=>!p.part):book.parts.sort((a,b)=>a.part-b.part)
 const correction=book.path.includes('同济高 等数学 第七版下册')
 return {...book,id:'ctb-'+createHash('sha256').update(book.path).digest('hex').slice(0,20),parts,complete:!parts[0].part||parts.every((p,i)=>p.part===i+1),...(correction?{title:'高等数学习题全解指南（第六版上册；仓库文件名有误）',kind:'supplement'}:{}),...verified[book.path]}
})
const catalog={...source,books}
for(const dir of [new URL('../public/textbooks/',import.meta.url),base]) {mkdirSync(dir,{recursive:true});writeFileSync(new URL('catalog.json',dir),JSON.stringify(catalog))}
console.log(JSON.stringify({commit:source.commit,books:books.length,verified:books.filter(b=>b.outline).length}))
