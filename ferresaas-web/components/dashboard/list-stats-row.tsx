import { ReactNode } from "react";

type ListStatsItem = {
  title: string;
  value: ReactNode;
  description: string;
  accent?: boolean;
};

type ListStatsRowProps = {
  items: ListStatsItem[];
  columnsClassName?: string;
};

export function ListStatsRow({ items, columnsClassName = "md:grid-cols-2" }: ListStatsRowProps) {
  return (
    <div className={`mb-6 grid gap-3 ${columnsClassName}`}>
      {items.map((item) => (
        <div
          key={item.title}
          className={item.accent ? "brand-accent-panel p-4" : "app-panel-muted rounded-[1.4rem] p-4"}
        >
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{item.value}</p>
          <p className={`mt-2 text-sm ${item.accent ? "brand-accent-subtle" : "text-muted-foreground"}`}>
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
