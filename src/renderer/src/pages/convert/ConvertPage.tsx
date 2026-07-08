import { useCallback, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import DropZone from './DropZone'
import PickList from './PickList'
import ConvertingView from './ConvertingView'
import DoneView from './DoneView'
import { useConvertStore } from '../../stores/convert'

export default function ConvertPage(): React.JSX.Element {
  const { phase, items, addPicked } = useConvertStore()
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)

  const pickViaDialog = useCallback(async () => {
    const files = await window.flash.pickFiles()
    if (files.length > 0) addPicked(files)
  }, [addPicked])

  const onDragEnter = (e: DragEvent): void => {
    e.preventDefault()
    if (phase !== 'pick') return
    dragDepth.current++
    setDragOver(true)
  }

  const onDragOver = (e: DragEvent): void => {
    e.preventDefault()
  }

  const onDragLeave = (e: DragEvent): void => {
    e.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOver(false)
  }

  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    if (phase !== 'pick') return
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.flash.getFilePath(f))
      .filter(Boolean)
    if (paths.length === 0) return
    const files = await window.flash.statFiles(paths)
    if (files.length > 0) addPicked(files)
  }

  return (
    <div
      style={{ height: '100%', position: 'relative' }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {phase === 'pick' && items.length === 0 && (
        <DropZone dragOver={dragOver} onPick={pickViaDialog} />
      )}
      {phase === 'pick' && items.length > 0 && <PickList onPick={pickViaDialog} />}
      {phase === 'converting' && <ConvertingView />}
      {phase === 'done' && <DoneView />}
    </div>
  )
}
