import { Building2, ShieldCheck, type LucideIcon } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';

interface PanelFeature {
  icon: LucideIcon;
  title: string;
  copy: string;
}

const PANEL_FEATURES: PanelFeature[] = [
  {
    icon: Building2,
    title: 'Negocio listo',
    copy: 'Se crea el espacio para tu ferretería.',
  },
  {
    icon: ShieldCheck,
    title: 'Dueño seguro',
    copy: 'Tu primer usuario queda con rol administrador y acceso completo.',
  },
];

export function RegisterMarketingPanel() {
  return (
    <section className="app-panel app-orbit hidden overflow-hidden p-8 lg:flex lg:min-h-160 lg:flex-col lg:justify-between xl:p-10">
      <div className="space-y-6">
        <BrandLogo className="h-20 w-auto" priority />

        <div className="max-w-xl space-y-3">
          <span className="app-kicker">
            <span className="app-brand-dot" aria-hidden="true" />
            Alta guiada en minutos
          </span>
          <p className="text-4xl font-semibold leading-tight text-foreground xl:text-5xl">
            Crea tu ferretería y entra directo al panel.
          </p>
          <p className="text-base leading-7 text-muted-foreground">
            Configuramos tu negocio, tu usuario dueño y los permisos iniciales para que puedas
            empezar por ventas, stock o caja sin pasos extra.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {PANEL_FEATURES.map(({ icon: FeatureIcon, title, copy }) => (
          <div key={title} className="app-panel-muted flex gap-4 rounded-[1.4rem] p-4">
            <span className="app-icon-badge h-11 w-11 text-[hsl(var(--accent))]">
              <FeatureIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
