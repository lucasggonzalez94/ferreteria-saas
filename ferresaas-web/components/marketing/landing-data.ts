import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  WalletCards,
  Warehouse,
} from "lucide-react";

export const landingNavItems = [
  { label: "Problemas", href: "#problemas" },
  { label: "Producto", href: "#producto" },
  { label: "Módulos", href: "#modulos" },
  { label: "Planes", href: "#planes" },
  { label: "FAQ", href: "#faq" },
];

export const painPoints = [
  {
    title: "Stock que no coincide",
    copy: "Dejás de vender porque el sistema, la góndola y el depósito no cuentan la misma historia.",
    metric: "-32%",
    metricLabel: "menos quiebres visibles",
  },
  {
    title: "Caja difícil de cerrar",
    copy: "Cada turno termina con dudas, diferencias y controles manuales que consumen tiempo del dueño.",
    metric: "8 min",
    metricLabel: "cierre visual mock",
  },
  {
    title: "Compras sin prioridad",
    copy: "Reposiciones por intuición, precios viejos y proveedores dispersos en cuadernos o Excel.",
    metric: "+18",
    metricLabel: "alertas de reposición",
  },
];

export const featureCards = [
  {
    title: "Inventario vivo",
    copy: "Alertas de stock bajo, movimientos y reposición para saber qué falta antes de perder la venta.",
    icon: Warehouse,
  },
  {
    title: "POS rápido",
    copy: "Venta ágil con scanner, carrito, descuentos controlados y medios de pago preparados para mostrador.",
    icon: ShoppingCart,
  },
  {
    title: "Caja bajo control",
    copy: "Aperturas, movimientos y cierres visuales para detectar diferencias sin planillas paralelas.",
    icon: WalletCards,
  },
  {
    title: "Compras y proveedores",
    copy: "Registrá compras, costos y cuentas por pagar para ordenar la reposición y cuidar margen.",
    icon: ClipboardList,
  },
  {
    title: "Reportes claros",
    copy: "Indicadores simples para entender ventas, productos críticos y rentabilidad operativa.",
    icon: BarChart3,
  },
  {
    title: "Facturación ARCA",
    copy: "Preparado para operar con comprobantes electrónicos en planes que lo incluyen.",
    icon: ReceiptText,
  },
];

export const mockStats = [
  { label: "Ventas de hoy", value: "$ 428.900", tone: "accent" },
  { label: "Productos críticos", value: "23", tone: "warning" },
  { label: "Caja abierta", value: "$ 96.450", tone: "neutral" },
];

export const mockProducts = [
  { name: "Cemento 50kg", stock: "8 bolsas", status: "Reponer" },
  { name: "Tornillo fix 8mm", stock: "124 u.", status: "OK" },
  { name: "Pintura látex blanco", stock: "3 latas", status: "Crítico" },
];

export const mockActivity = [
  "Venta confirmada en mostrador #1042",
  "Stock bajo detectado: Cemento 50kg",
  "Caja actualizada con pago mixto",
];

export const pricingPlans = [
  {
    name: "Básico",
    priceArs: "$12.000",
    priceUsd: "USD 12",
    description: "Para ferreterías chicas que quieren ordenar ventas y stock.",
    badge: "Para empezar",
    highlighted: false,
    features: ["1 usuario", "500 SKUs", "100 clientes", "POS", "Inventario básico", "Caja"],
  },
  {
    name: "Pro",
    priceArs: "$25.000",
    priceUsd: "USD 25",
    description: "Para negocios con equipo, proveedores y cuentas corrientes.",
    badge: "Más elegido",
    highlighted: true,
    features: ["5 usuarios", "5.000 SKUs", "Facturación ARCA", "Proveedores", "Compras", "Reportes"],
  },
  {
    name: "Empresa",
    priceArs: "$55.000",
    priceUsd: "USD 55",
    description: "Para ferreterías grandes o con operación más compleja.",
    badge: "Escalable",
    highlighted: false,
    features: ["20 usuarios", "20.000 SKUs", "3 locales", "API básica", "Soporte prioritario", "Reportes avanzados"],
  },
  {
    name: "Custom",
    priceArs: "A medida",
    priceUsd: "USD 120+",
    description: "Para cadenas o necesidades de integración específicas.",
    badge: "Enterprise",
    highlighted: false,
    features: ["Usuarios ilimitados", "Locales ilimitados", "API completa", "Integraciones", "White-label", "SLA"],
  },
];

export const faqs = [
  {
    question: "¿El trial pide tarjeta?",
    answer: "No. La prueba de 14 días está pensada para que evalúes el sistema sin fricción inicial.",
  },
  {
    question: "¿Puedo empezar con el plan Básico?",
    answer: "Sí. La landing muestra el camino visual para iniciar simple y subir de plan cuando tu operación lo necesite.",
  },
  {
    question: "¿Está pensado para ferreterías argentinas?",
    answer: "Sí. El posicionamiento inicial prioriza Argentina, precios en ARS y operación local.",
  },
  {
    question: "¿La información de esta landing es real?",
    answer: "Los precios y planes salen del documento de suscripciones. Las métricas visuales son mockups para representar la experiencia.",
  },
];

export const trustItems = [
  { label: "Sin tarjeta", icon: CreditCard },
  { label: "Datos protegidos", icon: ShieldCheck },
  { label: "Trial guiado", icon: Sparkles },
  { label: "Planes claros", icon: FileText },
];

export const steps = [
  {
    title: "Creá tu negocio",
    copy: "Una pantalla simple para empezar el trial con tu ferretería y usuario dueño.",
    icon: CheckCircle2,
  },
  {
    title: "Cargá productos clave",
    copy: "El primer valor aparece al ordenar stock crítico y productos de mayor rotación.",
    icon: Boxes,
  },
  {
    title: "Vendé con control",
    copy: "POS, caja e inventario trabajan juntos para que cada venta deje registro claro.",
    icon: PackageCheck,
  },
  {
    title: "Decidí con datos",
    copy: "Mirás alertas y reportes visuales para comprar mejor y reducir quiebres.",
    icon: TrendingUp,
  },
];
