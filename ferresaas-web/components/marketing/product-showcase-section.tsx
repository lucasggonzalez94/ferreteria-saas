import { AlertTriangle, ArrowUpRight, BarChart3, Package, ShoppingCart } from "lucide-react";

const showcaseRows = [
  ["Cemento 50kg", "8", "Reponer"],
  ["Disco diamantado", "42", "OK"],
  ["Pintura exterior", "3", "Crítico"],
  ["Cinta teflón", "187", "OK"],
];

const productBenefits = [
  { icon: Package, title: "Stock visible", copy: "Productos críticos arriba" },
  { icon: ShoppingCart, title: "Venta rápida", copy: "Mostrador sin fricción" },
  { icon: BarChart3, title: "Margen claro", copy: "Decisiones con señales" },
];

export function ProductShowcaseSection() {
  return (
    <section id="producto" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="app-panel overflow-hidden p-0">
          <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
            <div className="flex flex-col justify-between gap-10 bg-[hsl(var(--surface-strong))] p-7 text-primary-foreground sm:p-10 lg:p-12">
              <div>
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                  Producto en contexto
                </span>
                <h2 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
                  Una vista clara para decidir antes de comprar de más o quedarse corto.
                </h2>
                <p className="mt-5 text-base leading-8 text-white/70">
                  Este bloque es visual y mockeado: representa cómo la landing puede vender el resultado de usar Ferrahock sin depender todavía de datos reales.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {productBenefits.map(({ icon: Icon, title, copy }) => {
                  return (
                    <div key={title} className="rounded-[1.2rem] border border-white/10 bg-white/[0.06] p-4">
                      <Icon className="h-5 w-5 text-[hsl(var(--accent))]" />
                      <p className="mt-3 text-sm font-semibold">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/60">{copy}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative min-h-[620px] overflow-hidden p-5 sm:p-8 lg:p-10">
              <div className="landing-grid-bg" aria-hidden="true" />
              <div className="relative grid gap-5">
                <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-[0_28px_90px_-54px_rgba(12,41,69,0.8)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Inventario</p>
                      <h3 className="mt-1 text-2xl font-semibold">Productos que requieren atención</h3>
                    </div>
                    <span className="app-icon-badge h-12 w-12 text-[hsl(var(--accent))]">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-6 overflow-hidden rounded-[1.25rem] border border-border/70">
                    <div className="grid grid-cols-[1fr_80px_92px] bg-secondary/70 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      <span>Producto</span>
                      <span>Stock</span>
                      <span>Estado</span>
                    </div>
                    {showcaseRows.map(([name, stock, status]) => (
                      <div key={name} className="grid grid-cols-[1fr_80px_92px] items-center border-t border-border/60 px-4 py-4 text-sm">
                        <span className="font-semibold">{name}</span>
                        <span className="text-muted-foreground">{stock}</span>
                        <span className="rounded-full bg-[hsl(var(--brand-accent-soft))] px-2.5 py-1 text-center text-xs font-bold">
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-[0.92fr_1.08fr]">
                  <div className="brand-accent-panel p-5">
                    <p className="text-sm font-semibold">Sugerencia visual</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Comprar 24</p>
                    <p className="mt-2 text-sm leading-6 brand-accent-subtle">
                      Mock de recomendación para reponer antes del fin de semana.
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] border border-border/70 bg-card/90 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Rotación semanal</p>
                      <ArrowUpRight className="h-4 w-4 text-[hsl(var(--accent))]" />
                    </div>
                    <div className="mt-6 flex h-28 items-end gap-2">
                      {[38, 56, 42, 74, 62, 86, 70].map((height, index) => (
                        <span
                          key={index}
                          className="flex-1 rounded-t-full bg-[hsl(var(--accent)/0.72)]"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
