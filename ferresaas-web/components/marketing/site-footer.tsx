import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Image
            src="/icons/logo-principal-oscuro.png"
            alt="Ferrahock"
            width={176}
            height={58}
            className="h-11 w-auto dark:hidden"
          />
          <Image
            src="/icons/logo-principal-blanco.png"
            alt="Ferrahock"
            width={176}
            height={58}
            className="hidden h-11 w-auto dark:block"
          />
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Software para ferreterías que necesitan vender, controlar stock, cerrar caja y comprar con más información.
          </p>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-4 text-sm font-semibold text-muted-foreground">
          <Link href="/app/login" className="hover:text-foreground">Entrar</Link>
          <a href="#planes" className="hover:text-foreground">Planes</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
          <span>Términos</span>
          <span>Privacidad</span>
          <span>Soporte</span>
        </nav>
      </div>
    </footer>
  );
}
