import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("surface overflow-hidden", className)}>{children}</div>;
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-5">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {action}
    </div>
  );
}
