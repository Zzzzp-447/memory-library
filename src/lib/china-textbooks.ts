import { readPrintedToc } from './pdf-outline'

export interface ChinaBook {
 id: string; title: string; path: string; category: string; subject: string; kind: string; size: number; complete: boolean
 parts: { path: string; size: number; sha: string; part: number }[]
 outline?: string; outlineEvidence?: string
}
interface Catalog { commit: string; books: ChinaBook[] }
let catalog: Promise<Catalog> | undefined
export function chinaCatalog(): Promise<Catalog> {
 if (!catalog) catalog = fetch('/textbooks/catalog.json').then(async response => {
  if (!response.ok) throw new Error('教材索引无法读取，请更新应用或重试。')
  return response.json() as Promise<Catalog>
 }).catch(error => { catalog = undefined; throw error })
 return catalog
}
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/高数/g,'高等数学').replace(/[^\p{L}\p{N}]/gu,'')
export async function searchChinaBooks(query: string): Promise<ChinaBook[]> {
 const tokens=query.trim().split(/\s+/).map(normalize).filter(Boolean)
 if (!tokens.length) return []
 const {books}=await chinaCatalog()
 return books.filter(book=>tokens.every(token=>normalize(book.title+book.path).includes(token)))
 .sort((a,b)=>(Number(!!b.outline)*100+Number(b.kind==='textbook')*10+Number(b.category==='大学'))-(Number(!!a.outline)*100+Number(a.kind==='textbook')*10+Number(a.category==='大学'))||a.title.localeCompare(b.title,'zh-CN')).slice(0,40)
}
export async function readChinaOutline(id: string): Promise<{text:string;source:{title:string;url:string;edition:string}}> {
 const catalog=await chinaCatalog(); const book=catalog.books.find(book=>book.id===id)
 if (!book) throw new Error('教材不在当前知识库中，请重新搜索。')
 const source={title:book.title,url:`https://github.com/TapXWorld/ChinaTextbook/blob/${catalog.commit}/${book.parts[0].path.split('/').map(encodeURIComponent).join('/')}`,edition:`ChinaTextbook · ${catalog.commit.slice(0,7)}`}
 if (book.outline) return {text:book.outline,source:{...source,edition:`${source.edition} · ${book.outlineEvidence}`}}
 if (!book.complete) throw new Error('此教材在来源库中的分卷不完整，请使用其他版本或粘贴目录。')
 if (book.size>90*1024*1024) throw new Error('此教材超过90MB，手机端暂不自动读取。请打开来源核对目录后粘贴。')
 const pdfjs=await import('pdfjs-dist')
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).href
 const chunks: Uint8Array[]=[]
 for(const part of book.parts) {
  const url=`https://raw.githubusercontent.com/TapXWorld/ChinaTextbook/${catalog.commit}/${part.path.split('/').map(encodeURIComponent).join('/')}`
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)})
  if(!response.ok) throw new Error('教材下载失败，请稍后重试或粘贴目录。')
  const bytes=new Uint8Array(await response.arrayBuffer())
  if(bytes.length!==part.size) throw new Error('教材文件不完整，已停止读取。')
  const header=new TextEncoder().encode(`blob ${bytes.length}\0`); const blob=new Uint8Array(header.length+bytes.length);blob.set(header);blob.set(bytes,header.length)
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',blob))).map(n=>n.toString(16).padStart(2,'0')).join('')
  if(sha!==part.sha) throw new Error('教材校验不一致，已停止读取。')
  chunks.push(bytes)
 }
 const data=new Uint8Array(chunks.reduce((sum,chunk)=>sum+chunk.length,0));let offset=0
 for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
 const task=pdfjs.getDocument({data,isEvalSupported:false})
 try {
  const doc=await task.promise; const outline=await doc.getOutline()
  if(!outline?.length) {
   const text = await readPrintedToc(doc)
   return { text, source: { ...source, edition: source.edition + (text ? ' · PDF目录页文字' : ' · 未识别到目录') } }
  }
  const lines:string[]=[]
  const walk=(items:typeof outline,depth:number)=>{for(const item of items){if(lines.length>=200)return;const title=item.title.replace(/\s+/g,' ').trim();if(title)lines.push('  '.repeat(Math.min(depth,3))+title);walk(item.items,depth+1)}}
  walk(outline,0)
  return {text:lines.join('\n'),source:{...source,edition:source.edition+' · PDF目录书签'}}
 } finally {await task.destroy()}
}
