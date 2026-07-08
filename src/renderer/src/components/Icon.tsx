import type { CSSProperties } from 'react'

interface IconProps {
  name: string
  size?: number
  fill?: boolean
  className?: string
  style?: CSSProperties
}

/** Material Symbols Outlined 图标（连字体） */
export default function Icon({ name, size = 20, fill, className, style }: IconProps): React.JSX.Element {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ''}`}
      aria-hidden
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        userSelect: 'none',
        ...style
      }}
    >
      {name}
    </span>
  )
}
