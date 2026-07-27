import { useEffect, useRef, useState } from 'react'
import './LiveAzanVisualizer.css'

interface LiveAzanVisualizerProps {
  active: boolean
}

export function LiveAzanVisualizer({ active }: LiveAzanVisualizerProps) {
  const [levels, setLevels] = useState<number[]>(Array(16).fill(0.15))
  const frameRef = useRef<number>(0)
  const tickRef = useRef(0)

  useEffect(() => {
    if (!active) {
      setLevels(Array(16).fill(0.12))
      return undefined
    }

    const animate = () => {
      tickRef.current += 1
      setLevels(
        Array.from({ length: 16 }, (_, i) => {
          const wave = Math.sin(tickRef.current * 0.14 + i * 0.55)
          const pulse = Math.sin(tickRef.current * 0.08 + i * 0.2)
          return 0.2 + Math.abs(wave) * 0.45 + Math.abs(pulse) * 0.25
        }),
      )
      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [active])

  return (
    <div className="azan-visualizer" aria-hidden="true">
      {levels.map((h, i) => (
        <span key={i} className="azan-visualizer-bar" style={{ transform: `scaleY(${h})` }} />
      ))}
    </div>
  )
}
