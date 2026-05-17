import { cn } from "@/lib/utils"
import React from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input type={type} className={cn("forge-input", className)} {...props} />
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "forge-input min-h-[80px] resize-y",
        className
      )}
      {...props}
    />
  )
}
