import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pricingPlans } from "./landing-data";

export function PricingSection() {
  return (
    <section id="planes" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="app-kicker">
            <span className="app-brand-dot" aria-hidden="true" />
            Planes claros
          </span>
          <h2 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
            Empezá gratis. Elegí plan cuando Ferrahock ya te ordenó el mostrador.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Probá Ferrahock 14 días sin tarjeta. Cuando decidas seguir, elegí el plan que mejor calce con el tamaño de tu ferretería.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-4">
          {pricingPlans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex min-h-[560px] flex-col rounded-[1.6rem] border p-6 backdrop-blur-xl transition-all hover:-translate-y-1 ${
                plan.highlighted
                  ? "border-[hsl(var(--accent)/0.72)] bg-[hsl(var(--surface-strong))] text-white shadow-[0_34px_95px_-55px_rgba(12,41,69,0.95)]"
                  : "border-border/70 bg-card/94"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">{plan.name}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    plan.highlighted
                      ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
                      : "bg-[hsl(var(--brand-accent-soft))] text-foreground"
                  }`}
                >
                  {plan.badge}
                </span>
              </div>
              <p className={`mt-4 min-h-[72px] text-sm leading-6 ${plan.highlighted ? "text-white/82" : "text-muted-foreground"}`}>
                {plan.description}
              </p>

              <div className="mt-6">
                <p className="text-4xl font-semibold tracking-[-0.06em]">{plan.priceArs}</p>
                <p className={`mt-1 text-sm ${plan.highlighted ? "text-white/76" : "text-muted-foreground"}`}>
                  por mes · {plan.priceUsd}
                </p>
              </div>

              <ul className="mt-7 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        plan.highlighted
                          ? "bg-white/16 text-[hsl(var(--accent))]"
                          : "bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className={plan.highlighted ? "text-white/90" : "text-foreground/82"}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={`mt-auto w-full ${
                  plan.highlighted
                    ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent)/0.92)]"
                    : ""
                }`}
                variant={plan.highlighted ? "default" : "outline"}
              >
                <Link href="/app/register">Probar gratis 14 días</Link>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
