import type { MindElixirInstance } from 'mind-elixir'

/** Reuse the native menu and commands; show it before the native 500ms drag hold. */
export function installTouchContextMenu(mind: MindElixirInstance, onOpen: () => void) {
  const container = mind.container
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: { topic: HTMLElement; id: number; x: number; y: number } | undefined
  let consumed: number | undefined
  let menuTap: { item: HTMLLIElement | null; id: number; x: number; y: number; lastY: number; moved: boolean } | undefined
  const pointers = new Set<number>()
  const overlay = container.querySelector<HTMLElement>('.context-menu')
  const stopMenuClick = (event: Event) => { if (overlay?.classList.contains('touch-context-menu')) event.stopPropagation() }
  overlay?.addEventListener('click', stopMenuClick)
  const clear = () => { clearTimeout(timer); timer = undefined; pending = undefined }
  const inMenu = (target: EventTarget | null) => !!(target as Element | null)?.closest('.touch-context-menu:not([hidden])')
  const down = (event: PointerEvent) => {
    if (inMenu(event.target)) {
      menuTap = event.pointerType === 'touch' && event.isPrimary ? { item: (event.target as Element).closest('li'), id: event.pointerId, x: event.clientX, y: event.clientY, lastY: event.clientY, moved: false } : undefined
      if (event.pointerType === 'touch' && !event.isPrimary) onOpen()
      if (event.pointerType === 'touch') event.preventDefault()
      event.stopImmediatePropagation(); return
    }
    if (event.pointerType !== 'touch') return
    pointers.add(event.pointerId)
    clear()
    const topic = (event.target as Element).closest<HTMLElement>('me-tpc')
    if (pointers.size !== 1 || !event.isPrimary || !topic || topic.closest('#input-box') || topic.isContentEditable) return
    pending = { topic, id: event.pointerId, x: event.clientX, y: event.clientY }
    timer = setTimeout(() => {
      const press = pending; clear()
      if (!press || !press.topic.isConnected) return
      // Clear the native drag timer and pointer bookkeeping without changing data.
      container.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: press.id, pointerType: 'touch' }))
      consumed = press.id; onOpen()
      mind.selectNode(press.topic as Parameters<MindElixirInstance['selectNode']>[0])
      const overlay = container.querySelector<HTMLElement>('.context-menu')
      if (!overlay) return
      overlay.classList.add('touch-context-menu')
      const trigger = new MouseEvent('contextmenu', { clientX: press.x, clientY: press.y, button: 2 })
      Object.defineProperty(trigger, 'target', { value: press.topic })
      mind.bus.fire('showContextMenu', trigger)
      const menu = overlay.querySelector<HTMLElement>('.menu-list')
      if (!menu) return
      const view = window.visualViewport, left = view?.offsetLeft || 0, top = view?.offsetTop || 0
      const width = view?.width || innerWidth, height = view?.height || innerHeight
      menu.style.maxHeight = `${Math.max(120, height - 24)}px`
      menu.style.maxWidth = `${Math.max(160, width - 24)}px`
      menu.style.right = menu.style.bottom = 'auto'
      menu.style.left = `${Math.max(left + 12, Math.min(press.x + 8, left + width - menu.offsetWidth - 12))}px`
      menu.style.top = `${Math.max(top + 12, Math.min(press.y + 8, top + height - menu.offsetHeight - 12))}px`
    }, 450)
  }
  const move = (event: PointerEvent) => {
    if (inMenu(event.target)) {
      if (menuTap?.id === event.pointerId && Math.hypot(event.clientX - menuTap.x, event.clientY - menuTap.y) > 10) menuTap.moved = true
      if (menuTap?.id === event.pointerId) {
        const menu = overlay?.querySelector<HTMLElement>('.menu-list')
        if (menu && menuTap.moved) { event.preventDefault(); menu.scrollTop += menuTap.lastY - event.clientY }
        menuTap.lastY = event.clientY
      }
      event.stopImmediatePropagation(); return
    }
    if (pending?.id === event.pointerId && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 10) clear()
  }
  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId); clear()
    if (consumed === event.pointerId) { consumed = undefined; event.preventDefault(); event.stopImmediatePropagation(); return }
    if (menuTap?.id === event.pointerId) {
      const tap = menuTap; menuTap = undefined
      event.preventDefault(); event.stopImmediatePropagation(); onOpen()
      if (!tap.moved && tap.item && tap.item === (event.target as Element).closest('li') && !tap.item.classList.contains('disabled')) {
        const click = new MouseEvent('click', { clientX: event.clientX, clientY: event.clientY, button: 0 })
        Object.defineProperty(click, 'target', { value: tap.item })
        tap.item.onclick?.call(tap.item, click)
      } else if (!tap.moved && event.target === overlay && overlay) overlay.hidden = true
      return
    }
    if (inMenu(event.target)) event.stopImmediatePropagation()
  }
  const cancel = (event: PointerEvent) => { pointers.delete(event.pointerId); clear(); if (consumed === event.pointerId) consumed = undefined; if (menuTap?.id === event.pointerId) menuTap = undefined }
  const context = (event: Event) => {
    if (consumed !== undefined || inMenu(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); return }
    const overlay = container.querySelector<HTMLElement>('.touch-context-menu')
    overlay?.classList.remove('touch-context-menu')
    const menu = overlay?.querySelector<HTMLElement>('.menu-list')
    if (menu) { menu.style.maxHeight = ''; menu.style.maxWidth = '' }
  }
  const wheel = (event: Event) => { if (inMenu(event.target)) event.stopImmediatePropagation() }
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { const overlay = container.querySelector<HTMLElement>('.touch-context-menu'); if (overlay) overlay.hidden = true; clear() }
  }
  container.addEventListener('pointerdown', down, true)
  container.addEventListener('pointermove', move, true)
  container.addEventListener('pointerup', up, true)
  container.addEventListener('pointercancel', cancel, true)
  container.addEventListener('contextmenu', context, true)
  container.addEventListener('wheel', wheel, true)
  container.addEventListener('keydown', key, true)
  return () => {
    clear(); pointers.clear()
    overlay?.removeEventListener('click', stopMenuClick)
    container.removeEventListener('pointerdown', down, true); container.removeEventListener('pointermove', move, true)
    container.removeEventListener('pointerup', up, true); container.removeEventListener('pointercancel', cancel, true)
    container.removeEventListener('contextmenu', context, true); container.removeEventListener('wheel', wheel, true); container.removeEventListener('keydown', key, true)
  }
}
