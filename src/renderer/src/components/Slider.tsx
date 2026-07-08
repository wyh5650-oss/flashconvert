import styles from './Slider.module.css'

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange(value: number): void
}

export default function Slider({ value, min, max, step = 1, onChange }: SliderProps): React.JSX.Element {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      className={styles.slider}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ['--pct' as string]: `${pct}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}
