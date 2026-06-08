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
    copy: "El producto figura disponible, pero no aparece en góndola ni en depósito cuando el cliente lo pide.",
    metric: "Stock",
    metricLabel: "inventario actualizado",
  },
  {
    title: "Caja difícil de cerrar",
    copy: "Cada turno termina con diferencias, anotaciones sueltas y tiempo perdido revisando qué pasó.",
    metric: "Caja",
    metricLabel: "movimientos trazables",
  },
  {
    title: "Compras sin prioridad",
    copy: "Reposiciones por intuición, precios viejos y proveedores dispersos en cuadernos o Excel.",
    metric: "Compras",
    metricLabel: "reposición con criterio",
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

export const dashboardStats = [
  { label: "Ventas de hoy", value: "$ 428.900", tone: "accent" },
  { label: "Productos críticos", value: "23", tone: "warning" },
  { label: "Caja abierta", value: "$ 96.450", tone: "neutral" },
];

export const dashboardProducts = [
  { name: "Cemento 50kg", stock: "8 bolsas", status: "Reponer" },
  { name: "Tornillo fix 8mm", stock: "124 u.", status: "OK" },
  { name: "Pintura látex blanco", stock: "3 latas", status: "Crítico" },
];

export const dashboardActivity = [
  "Venta confirmada en mostrador #1042",
  "Stock bajo detectado: Cemento 50kg",
  "Caja actualizada con pago mixto",
];

export const pricingPlans = [
  {
    name: "Básico",
    priceArs: "$12.000",
    priceUsd: "USD 12",
    description: "Para ferreterías chicas que necesitan vender y controlar stock sin complicarse.",
    badge: "Para empezar",
    highlighted: false,
    features: ["1 usuario", "500 SKUs", "100 clientes", "POS", "Inventario básico", "Caja"],
  },
  {
    name: "Pro",
    priceArs: "$25.000",
    priceUsd: "USD 25",
    description: "Para negocios con equipo, compras frecuentes y más control administrativo.",
    badge: "Más elegido",
    highlighted: true,
    features: ["5 usuarios", "5.000 SKUs", "Facturación ARCA", "Proveedores", "Compras", "Reportes"],
  },
  {
    name: "Empresa",
    priceArs: "$55.000",
    priceUsd: "USD 55",
    description: "Para ferreterías con mayor volumen, varios usuarios o más de un local.",
    badge: "Escalable",
    highlighted: false,
    features: ["20 usuarios", "20.000 SKUs", "3 locales", "API básica", "Soporte prioritario", "Reportes avanzados"],
  },
  {
    name: "Custom",
    priceArs: "A medida",
    priceUsd: "USD 120+",
    description: "Para cadenas o negocios que necesitan integraciones y condiciones especiales.",
    badge: "Enterprise",
    highlighted: false,
    features: ["Usuarios ilimitados", "Locales ilimitados", "API completa", "Integraciones", "White-label", "SLA"],
  },
];

export const faqs = [
  {
    question: "¿La prueba gratis pide tarjeta?",
    answer: "No. Podés probar Ferrahock durante 14 días sin cargar una tarjeta al registrarte.",
  },
  {
    question: "¿Puedo empezar con el plan Básico?",
    answer: "Sí. Podés empezar con ventas, inventario y caja, y pasar a un plan superior cuando tu operación lo necesite.",
  },
  {
    question: "¿Está pensado para ferreterías argentinas?",
    answer: "Sí. Está pensado para la operación local: precios en ARS, mostrador, stock, caja, proveedores y facturación electrónica en los planes que la incluyen.",
  },
  {
    question: "¿Necesito cambiar toda mi forma de trabajar?",
    answer: "No. La idea es empezar por lo más urgente: cargar productos clave, vender con registro y ordenar el stock crítico. Después podés sumar compras, proveedores y reportes.",
  },
];

export const trustItems = [
  { label: "Sin tarjeta", icon: CreditCard },
  { label: "Datos protegidos", icon: ShieldCheck },
  { label: "Configuración guiada", icon: Sparkles },
  { label: "Planes claros", icon: FileText },
];

export const steps = [
  {
    title: "Creá tu negocio",
    copy: "Registrá tu ferretería y dejá lista la base para vender con control desde el primer día.",
    icon: CheckCircle2,
  },
  {
    title: "Cargá productos clave",
    copy: "Empezá por los productos que más se venden o más problemas generan cuando faltan.",
    icon: Boxes,
  },
  {
    title: "Vendé con control",
    copy: "POS, caja e inventario trabajan juntos para que cada venta deje registro claro.",
    icon: PackageCheck,
  },
  {
    title: "Decidí con datos",
    copy: "Usá alertas y reportes simples para comprar mejor y evitar faltantes repetidos.",
    icon: TrendingUp,
  },
];
