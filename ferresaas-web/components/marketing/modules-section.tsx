import { featureCards, steps } from "./landing-data";

export function ModulesSection() {
  return (
    <section id="modulos" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <span className="app-kicker">
              <span className="app-brand-dot" aria-hidden="true" />
              Módulos conectados
            </span>
            <h2 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              No son pantallas sueltas. Es la operación de la ferretería hablando el mismo idioma.
            </h2>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
            La propuesta visual muestra cómo cada módulo aporta al control de stock: vender, cobrar, comprar y reportar desde una experiencia consistente.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="group rounded-[1.5rem] border border-border/70 bg-card/86 p-6 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-[hsl(var(--accent)/0.38)] hover:bg-[hsl(var(--brand-accent-soft))]"
              >
                <span className="app-icon-badge h-14 w-14 rounded-[1.25rem] border-[hsl(var(--brand-accent-border))] bg-[hsl(var(--brand-accent-soft))] text-[hsl(var(--accent))]">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-6 text-2xl font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.copy}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-16 app-panel app-orbit overflow-hidden p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div>
              <span className="app-kicker">Trial visual</span>
              <h3 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">
                Del registro al primer control de stock, sin pedir tarjeta.
              </h3>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Este recorrido es una representación visual del onboarding. La lógica real se conecta en otra etapa.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-[1.35rem] border border-border/70 bg-background/72 p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-sm font-bold text-[hsl(var(--accent-foreground))]">
                        {index + 1}
                      </span>
                      <Icon className="h-5 w-5 text-[hsl(var(--accent))]" />
                    </div>
                    <h4 className="mt-5 text-lg font-semibold">{step.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.copy}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
