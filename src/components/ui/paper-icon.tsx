import type { CSSProperties } from 'react'

export function PaperIcon({ name, className = '' }: {
  name: 'plus' | 'minus' | 'maximize' | 'download' | 'check' | 'x' | 'pencil' | 'trash' | 'undo' | 'book-open' | 'arrow-left' | 'zoom-in' | 'zoom-out' | 'save' | 'image' | 'home' | 'folder' | 'arrow-right' | 'camera' | 'search' | 'layers' | 'tag' | 'chevron-right' | 'book' | 'smile'
  className?: string
}) {
  const image = `url("${import.meta.env.BASE_URL}paper/icons/${name}.svg")`
  return <span aria-hidden="true" className={`paper-icon ${className}`} style={{ maskImage: image, WebkitMaskImage: image } as CSSProperties} />
}
