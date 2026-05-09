import { faqs, trustItems } from "./landing-data";

export function FaqSection() {
  return (
    <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <div>
          <span className="app-kicker">
            <span className="app-brand-dot" aria-hidden="true" />
            Confianza v1
          </span>
          <h2 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
            Respuestas simples antes de empezar el trial.
          </h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Sin prueba social inventada. Esta primera versión prioriza claridad, seguridad básica y una propuesta comercial transparente.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="app-panel-muted flex items-center gap-3 p-4">
                  <span className="app-icon-badge h-10 w-10 text-[hsl(var(--accent))]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <article key={faq.question} className="rounded-[1.45rem] border border-border/70 bg-card/88 p-6 backdrop-blur-xl">
              <h3 className="text-xl font-semibold">{faq.question}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{faq.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
