import { ArrowRight } from "lucide-react";
import { painPoints } from "./landing-data";

export function PainSolutionSection() {
  return (
    <section id="problemas" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div className="landing-reveal">
            <span className="app-kicker">
              <span className="app-brand-dot" aria-hidden="true" />
              Problema real
            </span>
            <h2 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              El stock desordenado no avisa. Simplemente te hace perder ventas.
            </h2>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground landing-reveal landing-delay-1">
            La landing empieza por el dolor que más entiende el dueño: productos que faltan, caja que cuesta cerrar y compras que llegan tarde. Ferrahock transforma ese caos en alertas, decisiones y operación visible.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {painPoints.map((point, index) => (
            <article
              key={point.title}
              className="app-panel app-orbit group min-h-[280px] overflow-hidden p-6 transition-all hover:-translate-y-1 hover:border-[hsl(var(--accent)/0.38)]"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-5xl font-semibold tracking-[-0.06em] text-[hsl(var(--accent))]">
                  {point.metric}
                </span>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-[hsl(var(--accent))]" />
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {point.metricLabel}
              </p>
              <h3 className="mt-8 text-2xl font-semibold">{point.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{point.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
