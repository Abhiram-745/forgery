import { cn } from "@/lib/utils"
import React from "react"

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "ghost"
  glow?: boolean
}

export function Panel({
  className,
  variant = "default",
  glow = false,
  children,
  ...props
}: PanelProps) {
  return (
    <div
      className={cn(
        "forge-panel",
        variant === "elevated" && "shadow-lg",
        variant === "ghost" && "border-transparent bg-transparent",
        glow && "forge-glow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PanelHeader({
  className,
  children,
  ...props
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface PanelContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PanelContent({
  className,
  children,
  ...props
}: PanelContentProps) {
  return (
    <div className={cn("p-4", className)} {...props}>
      {children}
    </div>
  )
}
