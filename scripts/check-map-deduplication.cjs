const assert = require('node:assert/strict'), fs = require('node:fs')
;(async () => {
 const { deduplicateMap } = await import('../src/lib/deduplicate-map.ts')
 const image = n => ({ url: `memory-asset:${n}`, width: 44, height: 44 })
 const data = { nodeData: { id: 'root', topic: '高等数学', children: [
   { id: 'book1', topic: '高等数学 第7版 上册 同济大学', direction: 0, children: [{ id: 'ch1', topic: '第四章 不定积分', note: '笔记一', image: image('a'), metadata: { imageAttachment: image('a') }, children: [{ id: 'p1', topic: '换元积分法', children: [{ id: 'q1', topic: '题目 1', metadata: { kind: 'card-link', cardId: 'card1' } }] }] }] },
   { id: 'book2', topic: '高等数学  第7版 上册 同济大学', direction: 1, children: [{ id: 'ch2', topic: '第四章 不定积分', note: '笔记二', image: image('b'), metadata: { imageAttachment: image('b') }, children: [{ id: 'p2', topic: '换元积分法', children: [{ id: 'q2', topic: '题目 1', metadata: { kind: 'card-link', cardId: 'card2' } }] }, { id: 'unique', topic: '分部积分法' }] }] },
   { id: 'other', topic: '高等数学 第7版 下册 同济大学', children: [{ id: 'otherpoint', topic: '换元积分法' }] },
   { id: 'draft1', topic: 'New Node' }, { id: 'draft2', topic: 'New Node' }
 ] }, arrows: [{ id: 'a', from: 'ch2', to: 'p2' }, { id: 'b', from: 'q2', to: 'otherpoint' }], summaries: [{ id: 's', parent: 'ch2', start: 0, end: 1, label: '常用方法' }], meta: { attachedCardIds: ['card1', 'card2'] } }
 const original = structuredClone(data), result = deduplicateMap(data), all = n => [n, ...(n.children || []).flatMap(all)]
 assert.ok(result.changed); assert.deepEqual(data, original)
 const nodes = all(result.data.nodeData), book = nodes.find(n => n.id === 'book1'), chapter = nodes.find(n => n.id === 'ch1')
 assert.equal(book.children.length, 1)
 assert.equal(nodes.filter(n => n.topic === '第四章 不定积分').length, 1)
 assert.equal(nodes.filter(n => n.topic === '换元积分法').length, 2, 'Same title in a different book stays separate')
 assert.ok(nodes.some(n => n.id === 'unique')); assert.equal(nodes.filter(n => n.metadata?.cardId).length, 2, 'Different cards with the same display title survive')
 assert.ok(chapter.note.includes('笔记一') && chapter.note.includes('笔记二'))
 assert.deepEqual(nodes.filter(n => n.image).map(n => n.metadata.imageAttachment.url).sort(), ['memory-asset:a', 'memory-asset:b'])
 assert.deepEqual(result.data.arrows.map(a => [a.from, a.to]), [['ch1', 'p1'], ['q2', 'otherpoint']])
 const summary = result.data.summaries[0]; assert.equal(summary.parent, 'ch1')
 assert.ok(chapter.children.slice(summary.start, summary.end + 1).some(n => n.id === 'unique'))
 assert.equal(nodes.filter(n => n.topic === 'New Node').length, 2, 'New editor placeholders must not be merged')
 assert.deepEqual(result.data.meta, data.meta); assert.equal(deduplicateMap(result.data).changed, false)
 assert.deepEqual(deduplicateMap(result.data).data, result.data)
 const report = { passed: true, checks: ['重复教材及章节递归合并', '保留不同教材的同名知识点', '两侧独有知识点/题目/笔记/不同图片保留', '关联曲线及概要重定向', '原始数据不改动；重复运行无变化', '未编辑新节点不合并'] }
 fs.writeFileSync('verification/map-deduplication-report.json', JSON.stringify(report, null, 2)); console.log('PASS '+ report.checks.join('; '))
})().catch(error => { console.error(error); process.exitCode = 1 })
