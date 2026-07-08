import Modal from './Modal'
import Button from './Button'
import { useUiStore } from '../stores/ui'
import sponsorQr from '../assets/sponsor.jpg'
import styles from './SponsorModal.module.css'

/** 赞助弹窗：设置页/完成页可打开；第 3 次成功转换后自动弹一次 */
export default function SponsorModal(): React.JSX.Element | null {
  const open = useUiStore((s) => s.sponsorOpen)
  const setOpen = useUiStore((s) => s.setSponsorOpen)
  if (!open) return null
  return (
    <Modal
      open
      title="赞助作者"
      onClose={() => setOpen(false)}
      width={340}
      footer={<Button onClick={() => setOpen(false)}>谢谢支持</Button>}
    >
      <div className={styles.body}>
        <img src={sponsorQr} alt="支付宝赞助二维码" className={styles.qr} />
        <div className="t-headline-md">制作不易，求赞助 qwq</div>
        <span className={styles.caption}>打开支付宝「扫一扫」 · win96</span>
      </div>
    </Modal>
  )
}
