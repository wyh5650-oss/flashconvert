# 第三方组件与许可

闪转 FlashConvert 的全部格式转换能力均来自以下开源项目，特此致谢并按各自许可证声明。

## 随应用分发的组件

| 组件 | 用途 | 许可证 | 备注 |
| --- | --- | --- | --- |
| [FFmpeg](https://ffmpeg.org/)（gyan.dev essentials 构建，经 ffmpeg-static 分发） | 音视频转换、图片解码兜底 | **GPL v3** | 本应用调用独立的 ffmpeg.exe 子进程；该构建包含 GPL 组件（x264/x265 等），二进制未做任何修改，源码见 ffmpeg.org |
| [sharp](https://sharp.pixelplumbing.com/) / [libvips](https://www.libvips.org/) | 图片转换 | Apache-2.0 / LGPL-3.0 | 含 mozjpeg、libwebp、libavif 等编解码器 |
| [7-Zip](https://www.7-zip.org/)（7za，经 7zip-bin 分发） | 压缩包解压与重压 | LGPL-2.1 | 未包含 unRAR 代码 |
| [heic-convert](https://github.com/catdad-experiments/heic-convert) / [libheif](https://github.com/strukturag/libheif) | HEIC/HEIF 解码 | MIT / LGPL-3.0（WASM 构建） | |
| [Electron](https://www.electronjs.org/) | 应用框架 | MIT | |
| [React](https://react.dev/)、[Zustand](https://github.com/pmndrs/zustand)、[Framer Motion](https://www.framer.com/motion/) | 界面 | MIT | 已打包进渲染层产物 |
| [electron-store](https://github.com/sindresorhus/electron-store) | 设置与历史持久化 | MIT | |
| [Material Symbols](https://fonts.google.com/icons) | 图标字体 | Apache-2.0 | |

## 运行时按需下载的组件（不随应用分发）

| 组件 | 用途 | 许可证 | 备注 |
| --- | --- | --- | --- |
| [Pandoc](https://pandoc.org/) | 文档格式互转 | GPL v2+ | 首次转换文档时从官方 GitHub Release 下载至用户目录，由用户主动触发 |
| [LibreOffice](https://www.libreoffice.org/) | Office → PDF | MPL-2.0 | 仅检测并调用用户已自行安装的本机实例 |

## 合规说明

- 应用自身代码采用 MIT 许可。
- 对 GPL/LGPL 组件的使用方式均为**调用未修改的独立可执行文件/动态库**，不构成衍生作品的静态链接。
- 各组件完整许可证文本见其官方仓库；分发本应用时请保留本文件。
