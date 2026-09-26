import { IconEmpty } from "@/components/icons";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <IconEmpty className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-sm font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-stone-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
