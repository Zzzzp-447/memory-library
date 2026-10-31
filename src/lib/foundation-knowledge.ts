import type { MindElixirData, NodeObj } from 'mind-elixir'

type Point = { title: string; text: string; page: number; end?: number }
type Chapter = { title: string; aliases?: string[]; points: Point[] }
type Pack = { id: string; title: string; offset: number; chapters: Chapter[] }
const sourceCommit = 'e2b3f62213c77bb8c33c5be355f97625ea1b8b61'
const p = (title: string, text: string, page: number, end?: number): Point => ({ title, text, page, end })

export const foundationPacks: Pack[] = [
  { id: 'math7-upper', title: '同济《高等数学》第七版上册', offset: 15, chapters: [
    { title: '函数与极限', aliases: ['极限与连续'], points: [
      p('函数极限', 'lim(x→x₀) f(x)=L 表示 x 在 x₀ 的去心邻域内趋近 x₀ 时，f(x) 趋近 L。极限与 f(x₀) 是否定义、取何值无关。', 27, 28),
      p('连续性', '在 x₀ 连续：lim(x→x₀) f(x)=f(x₀)。需满足函数值有定义、极限存在且等于函数值。区间端点采用相应的单侧连续。', 57),
    ] },
    { title: '导数与微分', points: [
      p('导数的定义', 'f′(x₀)=lim(h→0)[f(x₀+h)−f(x₀)]/h，要求极限存在且有限。内点的导数采用双侧极限。', 75),
      p('可导与连续', '可导必连续，连续未必可导。例如 f(x)=|x| 在 0 连续但不可导。', 82),
      p('微分', 'dy=f′(x₀)dx，dx=Δx，Δy=dy+o(Δx)。微分是增量的线性主部，一般不能把 dy 与 Δy 直接视为相等。', 111),
    ] },
    { title: '微分中值定理与导数的应用', aliases: ['微分中值定理与应用', '导数的应用'], points: [
      p('拉格朗日中值定理', '若 a<b，f 在 [a,b] 连续、在 (a,b) 可导，则存在 ξ∈(a,b)，使 f(b)−f(a)=f′(ξ)(b−a)。使用前须检查连续性和可导性。', 127),
      p('洛必达法则（0/0 型）', '当 x→a 时 f(x)、g(x) 均趋于 0；在 a 的去心邻域内二者可导且 g′(x)≠0。若 lim f′(x)/g′(x) 存在或为无穷，则 lim f(x)/g(x) 等于它。先判定未定式及条件，不能直接对任意商求导。此处只列 0/0 型。', 133),
      p('导数与单调性', '函数在区间连续、内部可导时，内部 f′>0 可推出严格递增，f′<0 可推出严格递减。这是充分条件；严格递增不要求每一点导数都大于 0。', 144, 145),
    ] },
    { title: '不定积分', points: [
      p('原函数与积分常数', '若在同一区间 F′(x)=f(x)，则 ∫f(x)dx=F(x)+C。所有原函数相差一个常数，不能遗漏 C。', 184, 185),
      p('换元积分', '若 F′=f，φ 可导，则 ∫f(φ(x))φ′(x)dx=F(φ(x))+C。换元时须连同微分一起替换。', 194),
      p('分部积分', '∫u dv=uv−∫v du。这里 u、v 为同一区间内连续可导的函数。', 208),
    ] },
    { title: '定积分', points: [
      p('定积分的定义', '∫ₐᵇf(x)dx=lim Σf(ξᵢ)Δxᵢ。对有界函数，最大子区间长度趋于 0 时，和的极限须与分法、取点无关。[a,b] 上连续的函数一定可积。', 226, 227),
      p('牛顿—莱布尼茨公式', 'f 在 [a,b] 连续且 F′=f 时，∫ₐᵇf(x)dx=F(b)−F(a)。定积分的结果为数值，不附加任意常数 C。', 240),
    ] },
    { title: '定积分的应用', points: [
      p('微元法', '分割、近似、求和、取极限。选定变量和区间后，将局部量写成 dU=f(x)dx，再在可积条件下计算 U=∫ₐᵇf(x)dx。', 274, 276),
      p('平面区域面积', '若 [a,b] 上 f、g 连续且 f≥g，则 S=∫ₐᵇ[f(x)−g(x)]dx。曲线交叉时应按交点分段，或对差取绝对值积分。', 276, 277),
      p('旋转体体积', '非负连续函数 f 与 x 轴围成的区域绕 x 轴旋转：V=π∫ₐᵇ[f(x)]²dx。先确认旋转轴和截面半径。', 280),
    ] },
    { title: '微分方程', points: [
      p('方程、阶与解', '微分方程含未知函数及其导数；最高阶导数的阶数是方程的阶。将函数及其导数代入后恒满足方程，才是它的解。', 297, 298),
      p('一阶线性微分方程', '标准式 y′+P(x)y=Q(x)。P、Q 在所讨论区间连续时，取积分因子 μ=e^(∫P dx)，可得 y=μ⁻¹(∫μQ dx+C)。', 314, 316),
    ] },
  ] },
  { id: 'linear5', title: '同济《线性代数》第五版', offset: 11, chapters: [
    { title: '行列式', points: [
      p('二阶行列式', '方阵 [[a,b],[c,d]] 的行列式为 ad−bc。行列式是一个数，不是矩阵。', 1),
      p('行列式的基本性质', 'det(Aᵀ)=det(A)；交换两行使行列式变号；某一行乘 k，行列式也乘 k。对应的列操作同样成立。', 9, 10),
    ] },
    { title: '矩阵及其运算', points: [
      p('矩阵乘法', 'A 为 m×s、B 为 s×n 时，AB 为 m×n，cᵢⱼ=Σₖaᵢₖbₖⱼ。通常 AB≠BA；AB 存在不代表 BA 存在。', 34, 35),
      p('逆矩阵', '对方阵 A，若 AA⁻¹=A⁻¹A=I，则 A⁻¹ 是逆矩阵。方阵可逆当且仅当 det(A)≠0。', 43),
    ] },
    { title: '矩阵的初等变换与线性方程组', aliases: ['初等变换与线性方程组'], points: [
      p('矩阵的秩', '秩为最高阶非零子式的阶数，也等于行阶梯形矩阵的非零行数。0≤r(A)≤min(m,n)，行秩与列秩相等。', 65, 66),
      p('线性方程组解的判定', 'Ax=b 有 n 个未知量：r(A)<r([A|b]) 时无解；两秩相等且为 n 时唯一解；两秩相等且小于 n 时有无穷多解（实数域）。', 71, 72),
    ] },
    { title: '向量组的线性相关性', aliases: ['向量组与线性相关性'], points: [
      p('线性相关与无关', '存在不全为 0 的系数，使 Σkᵢαᵢ=0，则向量组线性相关；仅全零系数能满足该等式，则线性无关。', 87),
      p('极大无关组', '极大线性无关组包含的向量数为向量组的秩。矩阵的秩等于其行向量组、列向量组的秩。', 90),
    ] },
    { title: '相似矩阵及二次型', points: [
      p('特征值与特征向量', 'Ax=λx 且 x≠0 时，λ 为特征值、x 为对应特征向量。特征值满足 det(A−λI)=0；零向量不能作特征向量。', 117, 118),
      p('正定二次型', '实对称矩阵 A 的二次型 xᵀAx 对一切实非零 x 均大于 0 时为正定。等价判定：所有特征值为正，或所有顺序主子式为正。', 133),
    ] },
    { title: '线性空间与线性变换', points: [
      p('基与维数', '一组向量既线性无关、又能张成整个空间，才构成一组基。有限维空间的维数等于基中向量的个数；零空间维数为 0。', 141),
      p('线性变换', '线性变换保持加法与数乘：T(α+β)=Tα+Tβ，T(kα)=kTα。两条性质必须同时满足。', 146, 147),
    ] },
  ] },
]

export function foundationForSubject(subject: { id: string; name: string }): Pack | undefined {
  if (/英语|外语|日语|词汇|积累|english/i.test(subject.name) || subject.id === 'english') return
  if (/线性代数|线代|linear algebra/i.test(subject.name)) return foundationPacks[1]
  if (subject.id === 'math' || /高等数学|高数|微积分|calculus/i.test(subject.name)) return foundationPacks[0]
}

// Only these editions have had their body text and page numbers checked.
export function foundationForBook(title: string): Pack | undefined {
  if (/线性代数/.test(title) && /第五版|第5版/.test(title)) return foundationPacks[1]
  if (/高等数学/.test(title) && /第七版|第7版/.test(title) && /上册|上部/.test(title)) return foundationPacks[0]
}

export function foundationNote(pack: Pack, point: Point) {
  const printed = `${point.page}${point.end ? `–${point.end}` : ''}`
  const pdf = `${point.page + pack.offset}${point.end ? `–${point.end + pack.offset}` : ''}`
  return `${point.text}\n\n参考：${pack.title}，正文第 ${printed} 页（PDF 第 ${pdf} 页）。\n来源：ChinaTextbook 教材知识库。`
}

export function isFoundation(node?: NodeObj): boolean {
  return (node?.metadata as { kind?: string } | undefined)?.kind === 'foundation-point'
}

const normalize = (text: string) => text.replace(/\s|[：:、.．]/g, '').replace(/^第[一二三四五六七八九十\d]+章/, '').replace(/^\d+/, '')

// Attach concise facts to the corresponding section, rather than a parallel category.
const branches: Record<string, [string, string]> = {
  '函数极限': ['函数的极限', '极限与 f(x₀) 的取值无关'],
  '连续性': ['函数的连续性与间断点', '连续：lim f(x)=f(x₀)'],
  '导数的定义': ['导数概念', '导数是差商的有限极限'],
  '可导与连续': ['导数概念', '可导必连续，连续未必可导'],
  '微分': ['函数的微分', 'dy=f′(x)dx'],
  '拉格朗日中值定理': ['微分中值定理', '闭区间连续、开区间可导 → 中值定理'],
  '洛必达法则（0/0 型）': ['洛必达法则', '0/0 型：先检查条件，再求导比值'],
  '导数与单调性': ['函数的单调性与曲线的凹凸性', 'f′>0 递增；f′<0 递减'],
  '原函数与积分常数': ['不定积分的概念与性质', '∫f(x)dx=F(x)+C'],
  '换元积分': ['换元积分法', '换元时函数与微分一起替换'],
  '分部积分': ['分部积分法', '∫u dv=uv−∫v du'],
  '定积分的定义': ['定积分的概念与性质', '定积分是积分和的极限'],
  '牛顿—莱布尼茨公式': ['微积分基本公式', '∫ₐᵇf(x)dx=F(b)−F(a)'],
  '微元法': ['定积分的元素法', '分割 → 近似 → 求和 → 取极限'],
  '平面区域面积': ['定积分在几何学上的应用', '面积：上方函数减下方函数'],
  '旋转体体积': ['定积分在几何学上的应用', '绕 x 轴旋转：V=π∫ₐᵇf²(x)dx'],
  '方程、阶与解': ['微分方程的基本概念', '阶数由最高阶导数决定'],
  '一阶线性微分方程': ['一阶线性微分方程', 'y′+P(x)y=Q(x)，积分因子 μ=e^(∫P dx)'],
  '二阶行列式': ['二阶与三阶行列式', '二阶行列式：ad−bc'],
  '行列式的基本性质': ['行列式的性质', '交换两行变号；一行乘 k 则行列式乘 k'],
  '矩阵乘法': ['矩阵的运算', '内维相同才能相乘，通常 AB≠BA'],
  '逆矩阵': ['逆矩阵', '方阵可逆 ⇔ det(A)≠0'],
  '矩阵的秩': ['矩阵的秩', '秩等于阶梯形矩阵的非零行数'],
  '线性方程组解的判定': ['线性方程组的解', '有解 ⇔ r(A)=r([A|b])'],
  '线性相关与无关': ['向量组的线性相关性', '相关：存在不全为零的系数使线性组合为零'],
  '极大无关组': ['向量组的秩', '秩等于极大无关组的向量个数'],
  '特征值与特征向量': ['方阵的特征值与特征向量', 'Ax=λx，特征向量 x≠0'],
  '正定二次型': ['正定二次型', '正定：对所有非零 x，xᵀAx>0'],
  '基与维数': ['维数、基与坐标', '基须无关且张成全空间；基中向量个数为维数'],
  '线性变换': ['线性变换', '线性变换同时保持加法与数乘'],
}

/** Additive merge: stable metadata survives renames/moves; no user node or arrow is replaced. */
export function addFoundation(data: MindElixirData, pack: Pack, existingOnly = false): { data: MindElixirData; added: number; changed: boolean } {
  const next = structuredClone(data), nodes: NodeObj[] = []
  const removed = new Map<string, string>()
  const flatten = (parent: NodeObj) => {
    parent.children?.forEach(flatten)
    if (parent.children) parent.children = parent.children.flatMap(child => {
      if ((child.metadata as { foundationGroup?: string } | undefined)?.foundationGroup !== pack.id || child.topic !== '基础知识点') return [child]
      removed.set(child.id, parent.id)
      if (child.note) parent.note = [parent.note, child.note].filter(Boolean).join('\n\n')
      if (child.tags?.length) parent.tags = [...(parent.tags || []), ...child.tags]
      return child.children || []
    })
  }
  flatten(next.nodeData)
  next.arrows?.forEach(arrow => { arrow.from = removed.get(arrow.from) || arrow.from; arrow.to = removed.get(arrow.to) || arrow.to })
  const walk = (node: NodeObj) => { nodes.push(node); node.children?.forEach(walk) }
  walk(next.nodeData)
  let added = 0, hasChapter = false, reference: NodeObj | undefined
  for (const [ci, chapter] of pack.chapters.entries()) {
    const names = [chapter.title, ...(chapter.aliases || [])].map(normalize)
    let target = nodes.find(node => !isFoundation(node) && names.includes(normalize(node.topic)))
    if (!target && existingOnly) continue
    if (!target) {
      reference ||= nodes.find(node => (node.metadata as { foundationPack?: string } | undefined)?.foundationPack === pack.id)
      if (!reference) {
        reference = { id: crypto.randomUUID(), topic: `${pack.title} · 基础`, metadata: { foundationPack: pack.id }, children: [], direction: 1 }
        ;(next.nodeData.children ||= []).push(reference)
      }
      target = { id: crypto.randomUUID(), topic: chapter.title, children: [] }
      ;(reference.children ||= []).push(target)
    }
    hasChapter = true
    const chapterNodes: NodeObj[] = []
    const collect = (node: NodeObj) => { chapterNodes.push(node); node.children?.forEach(collect) }
    collect(target)
    for (const [pi, point] of chapter.points.entries()) {
      const foundationId = `${pack.id}:${ci}:${pi}`, [anchorTitle, label] = branches[point.title]
      let existing = nodes.find(node => (node.metadata as { foundationId?: string } | undefined)?.foundationId === foundationId)
      if ((existing?.metadata as { layoutVersion?: number } | undefined)?.layoutVersion === 2) continue
      const anchor = chapterNodes.find(node => normalize(node.topic) === normalize(anchorTitle)) || target
      if (existing) {
        // Preserve renamed or moved personal content. Only rearrange the original generated nodes.
        if (existing.topic !== point.title || !chapterNodes.includes(existing)) continue
        if (existing === anchor) {
          const { foundationId: _id, kind: _kind, ...rest } = existing.metadata as Record<string, unknown>
          existing.metadata = rest
          existing = undefined
        } else {
          const parent = nodes.find(node => node.children?.includes(existing!))
          if (parent) parent.children = parent.children?.filter(node => node !== existing)
          existing.topic = label
          existing.metadata = { ...(existing.metadata as object), layoutVersion: 2 }
          ;(anchor.children ||= []).push(existing)
          continue
        }
      }
      if (chapterNodes.some(node => node.topic === label)) continue
      const node: NodeObj = { id: crypto.randomUUID(), topic: label, note: foundationNote(pack, point), metadata: { kind: 'foundation-point', foundationId, reference: pack.title, sourceCommit, layoutVersion: 2 } }
      ;(anchor.children ||= []).push(node)
      nodes.push(node)
      added++
    }
  }
  if (hasChapter) next.meta = { ...next.meta, foundationLayout: { ...next.meta?.foundationLayout, [pack.id]: 2 } }
  return { data: next, added, changed: JSON.stringify(next) !== JSON.stringify(data) }
}

/** Remove only untouched generated facts; retain personal edits, images and descendants. */
export function removeGeneratedFoundation(data: MindElixirData) {
  const next = structuredClone(data), removed = new Set<string>()
  const visit = (node: NodeObj): NodeObj[] => {
    if (node.children) node.children = node.children.flatMap(visit)
    const meta = node.metadata as { foundationId?: string; foundationGroup?: string; foundationPack?: string; kind?: string } | undefined
    const referencePack = foundationPacks.find(item => item.id === meta?.foundationPack)
    if (referencePack && node.topic === `${referencePack.title} · 基础`) {
      node.children = node.children?.filter(child => {
        const empty = referencePack.chapters.some(chapter => child.topic === chapter.title) && !child.children?.length && !child.note && !child.image && !child.tags?.length
        if (empty) removed.add(child.id)
        return !empty
      })
      if (!node.children?.length && !node.note && !node.image && !node.tags?.length) { removed.add(node.id); return [] }
    }
    const [packId, ci, pi] = (meta?.foundationId || '').split(':')
    const pack = foundationPacks.find(item => item.id === packId), point = pack?.chapters[Number(ci)]?.points[Number(pi)]
    const standardNote = pack && point ? foundationNote(pack, point) : ''
    const oldNote = standardNote.replace('来源：ChinaTextbook 教材知识库。', `来源：ChinaTextbook，版本 ${sourceCommit}。`)
    const unchanged = point && [point.title, branches[point.title][1]].includes(node.topic) && (!node.note || node.note === standardNote || node.note === oldNote) && !node.image && !node.tags?.length
    const originalSection = point && node.topic === branches[point.title][0]
    if (originalSection && unchanged) delete node.note
    if ((meta?.foundationGroup && node.topic === '基础知识点' && !node.note && !node.image && !node.tags?.length) || (unchanged && !originalSection)) {
      removed.add(node.id); return node.children || []
    }
    if (meta?.foundationId || meta?.foundationGroup || meta?.foundationPack) {
      const { foundationId: _id, foundationGroup: _group, foundationPack: _pack, kind: _kind, ...rest } = node.metadata as Record<string, unknown>
      node.metadata = rest
    }
    return [node]
  }
  // A root can be a user-named section; it must always survive.
  if (next.nodeData.children) next.nodeData.children = next.nodeData.children.flatMap(visit)
  if (next.arrows) next.arrows = next.arrows.filter(arrow => !removed.has(arrow.from) && !removed.has(arrow.to))
  return { data: next, changed: JSON.stringify(next) !== JSON.stringify(data) }
}
