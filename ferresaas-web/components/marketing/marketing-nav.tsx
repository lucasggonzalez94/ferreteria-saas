import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { landingNavItems } from "./landing-data";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/78 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Ir al inicio" className="flex items-center">
          <Image
            src="/icons/logo-principal-oscuro.png"
            alt="Ferrahock"
            width={198}
            height={66}
            className="h-11 w-auto dark:hidden"
            priority
          />
          <Image
            src="/icons/logo-principal-blanco.png"
            alt="Ferrahock"
            width={198}
            height={66}
            className="hidden h-11 w-auto dark:block"
            priority
          />
        </Link>

        <nav aria-label="Secciones" className="hidden items-center gap-1 lg:flex">
          {landingNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/app/login">Entrar</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[0_18px_45px_-28px_hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.92)]"
          >
            <Link href="/app/register">Prueba gratis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
