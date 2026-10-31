import type { PDFDocumentProxy } from 'pdfjs-dist'

/** Extract printed TOCs, not chapter guesses from body text. Scans need verified data. */
export function printedTocLines(rows: string[], inContents: boolean): string[] {
  const result: string[] = []
  for (const row of rows) {
    const raw = row.replace(/\s+/g, ' ').trim()
    const paginated = /[.．·…_]{2,}\s*[\dIVXivx]+\s*$/.test(raw) || /\s\d{1,4}\s*$/.test(raw)
    if (!inContents && !paginated) continue
    const title = raw.replace(/[.．·…_]{2,}\s*[\dIVXivx]+\s*$/, '').replace(/\s+\d{1,4}\s*$/, '').trim()
    const chapter = /^(?:第\s*[一二三四五六七八九十百零〇两\d]+\s*[章篇部]|(?:chapter|part|unit)\s+[\divxlcdm]+\b)/i.test(title)
    const section = /^(?:第\s*[一二三四五六七八九十百\d]+\s*节|(?:习题\s*)?\d{1,2}\s*[.．－-]\s*\d{1,2}(?:[.．]\d{1,2})*)/.test(title)
    const numbered = /^\d{1,2}[.、．]\s*[^\d\s]/.test(title)
    if (title.length > 180 || (!chapter && !section && !numbered)) continue
    result.push((section ? '  ' : '') + title)
  }
  return result
}

export async function readPrintedToc(doc: Pick<PDFDocumentProxy, 'numPages' | 'getPage'>): Promise<string> {
  const lines: string[] = [], seen = new Set<string>()
  let contentsAt = -1
  for (let number = 1; number <= Math.min(doc.numPages, 32); number++) {
    const page = await doc.getPage(number)
    try {
      const content = await page.getTextContent()
      const rows: { y: number; items: { x: number; text: string }[] }[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const y = item.transform[5], x = item.transform[4]
        let row = rows.find(row => Math.abs(row.y - y) < 2)
        if (!row) { row = { y, items: [] }; rows.push(row) }
        row.items.push({ x, text: item.str })
      }
      const text = rows.sort((a, b) => b.y - a.y).map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
      const hasHeading = text.some(row => /^(?:目\s*录|contents|table\s+of\s+contents)$/i.test(row.trim()))
      if (hasHeading) contentsAt = number
      const entries = printedTocLines(text, hasHeading)
      for (const entry of entries) if (!seen.has(entry)) { seen.add(entry); lines.push(entry) }
      if (contentsAt > 0 && (number > contentsAt + 6 || (number > contentsAt && !entries.length))) break
    } finally { page.cleanup() }
  }
  const chapters = lines.filter(line => !line.startsWith('  ')).length
  return chapters > 0 && lines.length >= 3 ? lines.slice(0, 200).join('\n') : ''
}
