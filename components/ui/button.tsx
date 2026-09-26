import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-800 text-white shadow-lg shadow-brand-900/20 hover:bg-brand-900",
  secondary:
    "bg-white text-stone-700 ring-1 ring-stone-200 hover:text-brand-800 hover:ring-stone-300",
  ghost: "text-stone-600 hover:bg-white hover:text-stone-900",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 gap-1.5 rounded-full px-4 text-sm",
  md: "h-11 gap-2 rounded-full px-6 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    SIZES[size],
    VARIANTS[variant],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
