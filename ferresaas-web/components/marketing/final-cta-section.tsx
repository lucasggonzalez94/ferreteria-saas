import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="landing-final-cta relative overflow-hidden rounded-[2rem] border border-[hsl(var(--brand-accent-border))] p-8 text-center sm:p-12 lg:p-16">
          <div className="relative z-10 mx-auto max-w-4xl">
            <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/88">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--accent))]" />
              Prueba gratis sin tarjeta
            </span>
            <h2 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-6xl">
              Convertí el mostrador en una operación más ordenada.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/84">
              Probá Ferrahock sin tarjeta y empezá a ordenar ventas, stock y caja desde un solo lugar.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-14 bg-[hsl(var(--accent))] px-8 text-base text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent)/0.92)]"
              >
                <Link href="/app/register">
                  Probar gratis 14 días
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 border-white/24 bg-white/10 px-8 text-base text-white hover:bg-white/16 hover:text-white">
                <a href="#planes">Comparar planes</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
