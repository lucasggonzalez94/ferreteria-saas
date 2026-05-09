import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2, PackageSearch, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockActivity, mockProducts, mockStats, trustItems } from "./landing-data";

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
      <div className="landing-aurora" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="relative z-10 max-w-3xl">
          <span className="app-kicker landing-reveal">
            <span className="app-brand-dot" aria-hidden="true" />
            Software para ferreterías argentinas
          </span>
          <div className="mt-7 space-y-6 landing-reveal landing-delay-1">
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.94] text-foreground sm:text-6xl lg:text-7xl">
              Controlá el stock antes de perder la venta.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Ferrahock une inventario, POS, caja y compras para que el dueño vea qué falta, qué se vende y dónde se va la plata.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row landing-reveal landing-delay-2">
            <Button
              asChild
              size="lg"
              className="h-14 bg-[hsl(var(--accent))] px-7 text-base text-[hsl(var(--accent-foreground))] shadow-[0_26px_70px_-34px_hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.92)]"
            >
              <Link href="/app/register">
                Probar 14 días gratis
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 px-7 text-base">
              <a href="#planes">Ver planes</a>
            </Button>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3 landing-reveal landing-delay-3">
            {trustItems.slice(0, 3).map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="app-status-pill justify-center bg-card/70">
                  <Icon className="h-4 w-4 text-[hsl(var(--accent))]" />
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative landing-reveal landing-delay-2">
          <div className="landing-dashboard-card app-panel app-orbit overflow-hidden p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Panel de control</p>
                <h2 className="mt-1 text-2xl font-semibold">Ferretería Los Andes</h2>
              </div>
              <span className="rounded-full border border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] px-3 py-1 text-xs font-bold text-foreground">
                Online
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {mockStats.map((stat) => (
                <div key={stat.label} className="rounded-[1.2rem] border border-border/70 bg-background/70 p-4">
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.82fr]">
              <div className="rounded-[1.35rem] border border-border/70 bg-background/72 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="app-icon-badge h-10 w-10 text-[hsl(var(--accent))]">
                      <PackageSearch className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Stock crítico</p>
                      <p className="text-xs text-muted-foreground">Mock visual de inventario</p>
                    </div>
                  </div>
                  <Bell className="h-4 w-4 text-[hsl(var(--accent))]" />
                </div>
                <div className="space-y-3">
                  {mockProducts.map((product) => (
                    <div key={product.name} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 p-3">
                      <div>
                        <p className="text-sm font-semibold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.stock}</p>
                      </div>
                      <span className="rounded-full bg-[hsl(var(--brand-accent-soft))] px-3 py-1 text-xs font-bold text-foreground">
                        {product.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-border/70 bg-[hsl(var(--surface-strong))] p-4 text-primary-foreground shadow-[0_32px_80px_-50px_rgba(12,41,69,0.9)]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                    <ScanLine className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Actividad del mostrador</p>
                    <p className="text-xs text-white/62">Datos ficticios</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {mockActivity.map((item) => (
                    <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-sm text-white/82">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--accent))]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
