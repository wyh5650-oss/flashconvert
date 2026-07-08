/** 生成应用图标：蓝色渐变圆角方块 + 白色闪电（对应侧边栏 Logo），输出 build/icon.png + icon.ico */
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2E9BFF"/>
      <stop offset="1" stop-color="#0052CC"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#g)"/>
  <path d="M298 60 L132 300 L242 300 L214 452 L380 212 L270 212 Z" fill="#ffffff"/>
</svg>`

await mkdir('build', { recursive: true })
const src = Buffer.from(svg)
await writeFile('build/icon.png', await sharp(src).resize(512, 512).png().toBuffer())
const sizes = [256, 128, 64, 48, 32, 16]
const pngs = await Promise.all(sizes.map((s) => sharp(src).resize(s, s).png().toBuffer()))
await writeFile('build/icon.ico', await pngToIco(pngs))
console.log('icon.png + icon.ico written to build/')
