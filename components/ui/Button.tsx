import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "primary" | "gold" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-surface-2 border border-border text-text hover:bg-surface hover:border-gold-bright shadow-xs",
  primary: "bg-red border border-red text-white hover:bg-red-bright shadow-xs",
  gold: "bg-gold border border-gold text-white hover:bg-gold-bright shadow-xs",
  ghost: "bg-transparent border border-border text-text hover:bg-surface-2 hover:border-gold-bright",
  danger: "bg-danger border border-danger text-white hover:bg-[#a11e28] shadow-xs",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({ variant = "default", fullWidth, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    />
  );
}
