interface ProgressRingProps {
  progress: number // 0-100
  size?: number // diameter in pixels
  strokeWidth?: number
}

export function ProgressRing({ progress, size = 20, strokeWidth = 3 }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-border/30"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={`transition-all duration-300 ${
          progress === 100 
            ? "text-green-400"
            : progress >= 75
            ? "text-cyan-400"
            : progress >= 50
            ? "text-yellow-400"
            : "text-orange-400"
        }`}
      />
    </svg>
  )
}
