import { cn } from "@/lib/utils"

interface StatusIndicatorProps {
  status: "online" | "offline" | "busy" | "error"
  size?: "sm" | "md" | "lg"
  className?: string
}

const statusColors = {
  online: "bg-green-500",
  offline: "bg-muted-foreground",
  busy: "bg-yellow-500",
  error: "bg-red-500",
}

const sizeMap = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
}

export function StatusIndicator({
  status,
  size = "md",
  className,
}: StatusIndicatorProps) {
  return (
    <span className="relative flex">
      <span
        className={cn(
          "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
          statusColors[status],
          size === "sm" && "animate-none"
        )}
      />
      <span
        className={cn(
          "relative inline-flex rounded-full",
          statusColors[status],
          sizeMap[size],
          className
        )}
      />
    </span>
  )
}
