import styles from './TrafficLights.module.css'

/** macOS 风格红绿灯窗口控制：红=关闭 黄=最小化 绿=最大化/还原 */
export default function TrafficLights(): React.JSX.Element {
  return (
    <div className={styles.group}>
      <button
        className={`${styles.dot} ${styles.red}`}
        aria-label="关闭"
        onClick={() => window.flash.windowControl('close')}
      />
      <button
        className={`${styles.dot} ${styles.yellow}`}
        aria-label="最小化"
        onClick={() => window.flash.windowControl('minimize')}
      />
      <button
        className={`${styles.dot} ${styles.green}`}
        aria-label="最大化"
        onClick={() => window.flash.windowControl('maximize')}
      />
    </div>
  )
}
