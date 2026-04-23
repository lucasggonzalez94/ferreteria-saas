# Plan de Suscripciones y Precios - FerreSaaS

## Resumen Ejecutivo

Este documento define la estrategia de monetización, planes de suscripción, precios y estructura de features para el SaaS de ferreterías.

---

## Investigación de Mercado Completada

### Hallazgos Clave

#### 1. Competencia Directa (Sistemas POS para Ferreterías)

| Competidor | País | Plan Básico | Plan Pro | Plan Premium |
|------------|------|------------|----------|--------------|
| **Pos Ferretería** | México | $45 USD/mes | $60 USD/mes | $99 USD/mes |
| **FPOS** | México | $750 MXN/mes | $1,650 MXN/mes | - |
| **Ferrefy** | Perú | S/99/mes (~$27 USD) | S/399/mes (~$110 USD) | - |
| **Ferretero** | Perú | - | S/148/mes (~$40 USD) | S/197/mes (~$54 USD) |
| **Kladi** | México | Gratis* | $380 MXN/mes | $500 MXN/mes |
| **GridPOS** | Colombia | - | $49 USD/mes | $99 USD/mes |
| **Alegra POS** | RD/MX | $25 USD/mes | $79 USD/mes | $99 USD/mes |

*Plan gratuito con límite de $120,000 MXN/mes en ventas

#### 2. Rangos de Precio del Mercado

| Tipo de Negocio | Precio Mensual MXN | Equivalente USD |
|-----------------|-------------------|----------------|
| Micro negocios (básicos) | $100 - $300 MXN | $5 - $15 USD |
| Pymes (intermedios) | $300 - $800 MXN | $15 - $40 USD |
| Cadenas/avanzados | $800+ MXN | $40+ USD |

#### 3. Benchmark SaaS Global (2025)

| Métrica | Valor |
|---------|-------|
| Precio entry-level median | $29/usuario/mes |
| SMB Starter/Basic median | $15/usuario/mes |
| SMB Professional median | $35/usuario/mes |
| SMB Business median | $65/usuario/mes |
| Aumento de precios YoY | 8-12% |

#### 4. Perfil del Mercado Ferretero Latam

**Estructura del mercado:**
- 95%+ son pymes (pequeños negocios familiares)
- Colombia: ~38,000 ferreterías
- México: sector representa 9% del PIB
- Costa Rica: 3 ferreterías grandes (1,000+ empleados cada una)
- Alto nivel de informalidad

**Ventas mensuales típicas:**
| Tipo de Ferretería | Ventas USD/mes | Margen |
|-------------------|---------------|--------|
| De barrio | $1,500 - $4,000 | 25% - 35% |
| Urbana mediana | $4,000 - $10,000 | 20% - 30% |
| Especializada | $12,000+ | 15% - 25% |

**Gasto en software:**
- Las ferreterías de barrio típicamente NO pagan por software
- Las que pagan: $10 - $50 USD/mes
- SMB promedio gasta $287 USD/mes en software total

#### 5. Disposición a Pagar

- 61% de suscriptores reconsideran suscripciones por economía
- 26% han cancelado suscripciones
- Promedio de $17 USD/mes en suscripciones no usadas
- Ferreterías Latam muy sensibles a precio

### Análisis de Posicionamiento

**Tu producto vs Competencia:**

| Aspecto | FerreSaaS | Competidores |
|---------|-----------|--------------|
| Especializado ferreterías | ✅ | Mixto |
| Facturación ARCA | ✅ (Argentina) | Mayormente CFDI (México) |
| Enfoque Latam | ✅ | General |
| Precio | Más bajo vs mercado | Medio-alto |
| Features completas | ✅ | Variable |

**Ventaja competitiva:**
- Precio más bajo que la competencia directa
- Especializado para ferreterías
- Facturación ARCA (diferenciador para Argentina)
- Enfoque Latam (soporte localized)

---

## Modelo de Negocio

### Enfoque General
- **Modelo**: Suscripción recurrente (mensual/anual)
- **Target**: Ferreterías pequeñas y medianas en Latinoamérica
- **Monedas**: ARS (Argentina) + USD (externos)
- **Orientación**: Precio accesible para mercados Latam, con capacidad de escalar

---

## Planes de Suscripción

### Estructura de Planes

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    PLANES FERREESAAS                                    │
├──────────────┬──────────────┬──────────────┬─────────────────────────────┤
│              │             │              │                             │
│   BÁSICO     │   PRO       │   EMPRESA    │   CUSTOM                  │
│              │             │              │                             │
│  1 usuario   │  5 usuarios │  20 usuarios │  Usuarios ilimitados       │
│  Ferretería   │  Ferretería  │  Ferretería   │  Múltiples locales       │
│  pequeña     │  mediana    │  grande     │  + características custom │
│              │             │              │                             │
└──────────────┴──────────────┴──────────────┴─────────────────────────────┘
```

---

## Plan Básico

### Perfil del Cliente
- Ferretería de barrio con 1-2 empleados
- Propietario hace la mayoría de las tareas
- Facturación mensual baja ($1,500-4,000 USD/mes)
- Necesita digitalizar ventas e inventario
- Sensible a precio

### Precio Basado en Investigación

> **Hallazgo**: El mercado acepta $5-15 USD/mes para planes básicos de POS
> **Competidor más barato**: $9 USD/mes (Alegra RD)
> **Decisión**: Posicionarse ligeramente debajo para capturar mercado sensibles a precio

| Moneda | Mensual | Anual (ahorro 20%) |
|--------|--------|-------------------|
| **ARS** | $12.000/mes | $115.200/año |
| **USD** | $12/mes | $115/año |

### Features Incluidas

| Módulo | Feature | Límite |
|--------|--------|--------|
| **Auth** | Login/Cerrar sesión | 1 usuario |
| **Dashboard** | Stats básicos del día | ✅ |
| **POS** | Punto de venta | ✅ |
| **Productos** | Gestión de productos | 500 SKUs |
| **Categorías** | Gestión de categorías | ✅ |
| **Inventario** | Stock básico | ✅ |
| **Clientes** | Gestión de clientes | 100 clientes |
| **Caja** | Apertura/cierre | ✅ |
| **Reportes** | Ventas del día | ✅ |

### Features NO Incluidas
- Múltiples usuarios
- Facturación ARCA
- Cuentas corrientes avanzadas
- Proveedores
- Compras
- Reportes avanzados
- API de integración
- Prioridad en soporte

---

## Plan Pro

### Perfil del Cliente
- Ferretería establecida con 3-5 empleados
- Necesita gestión de empleados y turnos
- Facturación moderada ($4,000-10,000 USD/mes)
- Quiere contrôle de cuentas corrientes
- Está dispuesto a pagar por valor

### Precio Basado en Investigación

> **Hallazgo**: Planes intermedios en Latam van de $25-60 USD/mes
> **Competidor**: Alegra Pro $79 USD, Pos Ferretería $60 USD
> **Decisión**: Posicionarse competitivos pero accesible

| Moneda | Mensual | Anual (ahorro 20%) |
|--------|--------|-------------------|
| **ARS** | $25.000/mes | $240.000/año |
| **USD** | $25/mes | $240/año |

### Features Incluidas

| Módulo | Feature | Límite |
|--------|--------|--------|
| **Todo del Básico** | | |
| **Usuarios** | Gestión de usuarios | 5 usuarios |
| **Facturación** | ARCA electrónica | ✅ |
| **Cta Corriente** | Gestión completa | 500 clientes |
| **Proveedores** | Gestión de proveedores | ✅ |
| **Compras** | Registro de compras | ✅ |
| **Inventario** | Stock alerts | ✅ |
| **Reportes** | Ventas, productos | ✅ |
| **Caja** | Arqueo de caja | ✅ |

### Features NO Incluidas
- Múltiples locales
- API de integración
- White-label
- Soporte prioritario 24/7

---

## Plan Empresa

### Perfil del Cliente
- Cadena de ferreterías o ferretería grande
- Múltiples empleados y turnos
- Vende gran volumen ($10,000+ USD/mes)
- Necesita múltiples locales
- Requiere reportes avanzados

### Precio Basado en Investigación

> **Hallazgo**: Planes empresariales en Latam van de $75-150 USD/mes
> **Competidor**: Pos Ferretería Premium $99 USD
> **Decisión**: Posicionarse competitivo

| Moneda | Mensual | Anual (ahorro 20%) |
|--------|--------|-------------------|
| **ARS** | $55.000/mes | $528.000/año |
| **USD** | $55/mes | $528/año |

### Features Incluidas

| Módulo | Feature | Límite |
|--------|--------|--------|
| **Todo del Pro** | | |
| **Usuarios** | Gestión de usuarios | 20 usuarios |
| **Locales** | Multi-local | 3 locales |
| **Reportes** | Avanzados | ✅ |
| **Descuentos** | Por cliente | ✅ |
| **Sincronización** | Cloud sync | ✅ |
| **Soporte** | Email prioritario | ✅ |
| **API** | API basic | ✅ |

### Features NO Incluidas
- Usuarios ilimitados
- Locales ilimitados
- White-label
- Integraciones custom

---

## Plan Custom (Enterprise)

### Perfil del Cliente
- Cadenas grandes de ferreterías
- Necesita integraciones específicas
- Personalización total
- Multiple empresa

### Precio Basado en Investigación

> **Hallazgo**: Enterprise en Latam típicamente $150+ USD/mes
> **Decisión**: Precio de entrada competitivo

| Moneda | Mensual |
|--------|--------|
| **USD** | $120+/mes |

### Features Incluidas

| Módulo | Feature | Límite |
|--------|--------|--------|
| **Todo del Empresa** | | |
| **Usuarios** | Ilimitados | ✅ |
| **Locales** | Ilimitados | ✅ |
| **API** | API completa | ✅ |
| **Integraciones** | Custom | ✅ |
| **White-label** | Marca blanca | ✅ |
| **Soporte** | 24/7 dedicado | ✅ |
| **SLA** | Garantía 99.9% | ✅ |

---

## Comparativa de Features

### Matriz de Features por Plan

| Feature | Básico | Pro | Empresa | Custom |
|---------|--------|-----|---------|-------|
| **Usuarios** | 1 | 5 | 20 | ∞ |
| **Clientes** | 100 | 500 | 2000 | ∞ |
| **Productos/SKUs** | 500 | 5000 | 20000 | ∞ |
| **Facturación ARCA** | ❌ | ✅ | ✅ | ✅ |
| **Cta Corriente** | Basic | ✅ | ✅ | ✅ |
| **Proveedores** | ❌ | ✅ | ✅ | ✅ |
| **Compras** | ❌ | ✅ | ✅ | ✅ |
| **Multi-local** | ❌ | ❌ | 3 | ∞ |
| **API Access** | ❌ | ❌ | ✅ | ✅ |
| **White-label** | ❌ | ❌ | ❌ | ✅ |
| **Soporte** | Email | Email | Priority | 24/7 |
| **SLA** | ❌ | ❌ | ✅ | ✅ |

---

## Descuentos y Promociones

### Estrategias de Descuento

| Estrategia | Descripción | Aplicar |
|------------|------------|--------|
| **Pago anual** | 20% descuento | Todos los planes |
| **Pago semestral** | 10% descuento | Planes Pro+ |
| **ONGs/Charidades** | 50% descuento | Bajo evaluación |
| **Startups nuevas** | 30% descuento primer año | Solo básico |
| **Referidos** | 1 mes gratis por referido | Todos |

### Notas
- Descuentos no acumulables
- El descuento por anual es el más alto porque mejora el cash flow
- Considerar precios psicológicos ($14.900 vs $15.000)

---

## Costos y Margen

### Costo por Cliente (Estimado)

| Recurso | Costo Unitario | Costo por Cliente |
|--------|----------------|------------------|
| Supabase (Free tier) | $0 | ~$0 |
| Vercel (Free tier) | $0 | ~$0 |
| Render (Free tier) | $0 | ~$0 |
| Dominio | $10/año | ~$0.83/mes |
| **Total infrastruktur** | | **~$1/mes** |

### Margen por Plan (Actualizado)

| Plan | Precio (USD) | Costo | Margen |
|------|-------------|------|-------|
| Básico | $12 | $1 | 92% |
| Pro | $25 | $1 | 96% |
| Empresa | $55 | $2 | 96% |
| Custom | $120 | $3 | 97.5% |

### Punto de Equilibrio
- **Clientes mínimos para cubrir costos**: 1 cliente básico
- **Objetivo para sustentabilidad**: 10 clientes = $120/mes ingresos vs $10/mes costos

### Proyección de Ingresos

| Clientes | Plan Mix | Ingresos Mensuales |
|----------|----------|---------------------|
| 10 | 7x Básico, 3x Pro | $159 USD |
| 25 | 15x Básico, 8x Pro, 2x Empresa | $446 USD |
| 50 | 25x Básico, 15x Pro, 8x Empresa, 2x Custom | $1,295 USD |
| 100 | 40x Básico, 35x Pro, 20x Empresa, 5x Custom | $2,690 USD |

---

## Resumen de Precios Finales (Basado en Investigación)

| Plan | USD/mes | ARS/mes* | Posicionamiento |
|------|---------|----------|------------------|
| **Básico** | $12 | $12.000 | 20% debajo de competencia más barata |
| **Pro** | $25 | $25.000 | 32% debajo de Pos Ferretería Pro ($60) |
| **Empresa** | $55 | $55.000 | 45% debajo de Pos Ferretería Premium ($99) |
| **Custom** | $120+ | - | Competitivo para Latam |

*Conversión ARS aproximada. Ajustar según tipo de cambio.

---

## Consideraciones Especiales

### Precio en ARS (Argentina)
El mercado argentino tiene características únicas:
- Alta inflación histórica
- Usuarios prefieren precios en USD even si pagan en ARS
- Mercado muy sensible a precios

### Estrategias Recomendadas

1. **Precio psicologico**:
   - $14.900 en vez de $15.000
   - $34.900 en vez de $35.000

2. **Dólar oficial vs paralelo**:
   - Considerar aceitar pago vía Mercado Pago (con surcharge)
   - Ofrecer descuento para pagos en USD

3. **Pricing internacional**:
   - Para clientes fuera de Argentina: solo USD
   - Ajustar precios por poder adquisitivo

---

## Upgrade/Downgrade

### Política de Cambios
- **Upgrade**: Efectivo inmediato, prorrateo del pago
- **Downgrade**: Efectivo fin del período actual
- **Cancelación**: Fin del período pagado, retención de datos 30 días

### Plan de Prorrateo
Al hacer upgrade a mitad de mes:
- Se cobra solo la diferencia
- Se tiene acceso inmediato a nuevas features

---

## Trial y Onboarding

### Período de Prueba
- **14 días gratis** sin tarjeta
- No incluye features de pago
- Solo plan Básico

### Flujo de Trial
1. Registro sin tarjeta
2. Acceso a demo data
3. Tour guiado (onboarding)
4. Upgrade cuando necesiten más

### Onboarding Included
- Video tutoriales
- Documentación en línea
- Chat de soporte (solo durante trial para Básico)

---

## Cobranza

### Métodos de Pago

| Método | Disponibilidad | Notas |
|--------|---------------|-------|
| **Transferencia** | ARS | Bank solo Argentina |
| **Mercado Pago** | ARS | Con surcharge 5% |
| **PayPal** | USD | Internacional |
| **Stripe** | USD | Internacional |
| **Coinspaid** | Crypto | BTC, ETH, USDT |

### Gestión de Cobranza
- **Intento de cobro**: 3 días antes de vencimiento
- **Recordatorio**: 1 día antes
- **Suspensión**: 5 días después (sin acceso)
- **Corte**: 15 días después

---

## Impuestos (Argentina)

### Consideraciones Fiscales
- **IVA**: 21% sobre servicio digital
- **Ganancias**: Depende de situación fiscal del vendedor
- **Certificado**: puede requerirse para operaciones B2B

### Recomendación
- Consultar con contador local
- Considerar usar plataformas de cobranza que manejen impuestos

---

## Checklist de Implementación

### Pre-lanzamiento
- [ ] Definir precios finales
- [ ] Configurar portal de cliente en Supabase
- [ ] Implementar sistema de roles por plan
- [ ] Limitar features según plan
- [ ] Configurar Stripe/Mercado Pago
- [ ] Crear página de precios
- [ ] Términos y condiciones

### Post-lanzamiento
- [ ] Monitorear conversión trial→paid
- [ ] Ajustar precios según feedback
- [ ] Analizar uso de features por plan
- [ ] Optimizar onboarding

---

## Próximos Pasos

1. **Validar precios con usuarios reales**: Antes de lanzar, habla con 5-10 ferreterías sobre los precios
2. **Ajustar conversión ARS/USD**: Definir tipo de cambio fijo para estabilidad
3. **Considerar pricing basado en uso**: Para planes superiores, limitar por número de transacciones
4. **Revisar precios post-lanzamiento**: Ajustar según conversión trial→pago

---

## Guía para Ajustar Precios

### Cuándo Ajustar Precios

#### Señales para SUBIR Precios

| Señal | Qué buscar | Acción recomendada |
|-------|------------|-------------------|
| **Demanda alta** | Lista de espera, alta conversión trial→paid (>15%) | Subir 10-20% |
| **Usage alto** | Clientes usando 80%+ de sus límites | Crear plan superior |
| **Churn bajo** | Menos de 3% mensual | Indica que puedes cobrar más |
| **Competencia subiendo** | Competidores suben precios | Subir para no quedar barato |
| **Costos subiendo** | Inflación, costos de infraestructura | Subir proporcionalmente |
| **NPS alto** | Clientes satisfechos (NPS >50) | Espacio para subir |

#### Señales para MANTENER/Bajar Precios

| Señal | Qué buscar | Acción recomendada |
|-------|------------|-------------------|
| **Conversión baja** | Trial→paid <5% | Mejorar onboarding o bajar precio |
| **Churn alto** | Más de 5% mensual | Investigar por qué se van |
| **Objeciones de precio** | "Muy caro" en feedback | Bajar o agregar valor |
| **Mercado en crisis** | Recesión económica | Mantener o ofrecer descuentos |
| **Competencia bajando** | Precios más bajos en mercado | Evaluar estrategia |

### Cómo Ajustar Precios

#### Estrategia de Suba Gradual

1. ** announce con anticipación**: 30-60 días antes
2. **Solo para nuevos clientes**: Los actuales mantienen precio viejo
3. **Ofrecer lock-in**: Descuento por anual si mantienen precio actual
4. **Aumentos pequeños**: 10-20% máximo por vez
5. **Justificar el aumento**: Nuevas features, mejoras

#### Fórmula para Suba de Precio

```
Precio nuevo = Precio actual × (1 + % inflacción) × (1 + % valor agregado)
```

**Ejemplo**:
- Precio actual: $25 USD
- Inflación 12 meses: 50% (ARS)
- Valor agregado nuevo: 20%
- Precio nuevo: $25 × 1.5 × 1.2 = $45 USD

#### Pricing Psychology

| Técnica | Ejemplo | Aplicar a |
|---------|---------|-----------|
| **Precio encantado** | $24.99 vs $25 | Siempre |
| **Anual = 2 meses gratis** | "$240/año (ahorras $60)" | Todos los planes |
| **Versus** | "vs $60/mes competencia" | En página de precios |
| **Tier highlight** | "Más popular" en Pro | Plan objetivo |

### Cuánto Ajustar

#### Rangos Recomendados

| Tipo de ajuste | Rango | Frecuencia |
|---------------|-------|------------|
| **Aumento regular** | 5-15% | Cada 12-18 meses |
| **Aumento por valor** | 15-30% | Cuando agregas features significativas |
| **Aumento de plan** | Nuevo precio del plan | Cuando creas plan superior |
| **Descuento promo** | 10-30% | Para lanzamiento, referidos |

#### Por Plan

| Plan | Suba máxima | Cuándo aplicar |
|------|-------------|----------------|
| Básico | 20% | Anual, por inflación ARS |
| Pro | 15% | Cada 12 meses |
| Empresa | 10% | Cada 18 meses |
| Custom | 0% | Negociación individual |

### Calendario de Revisión de Precios

| Momento | Revisar | Acción |
|--------|---------|--------|
| **Mensual** | Conversión y churn | Sin cambios |
| **Trimestral** | Métricas completas | Ajustes menores |
| **Anual** | Todos los precios | Incremento por inflación |
| **Post-launch** | 3 meses | Revisar estructura |

### Métricas Clave para Monitorear

```javascript
// KPIs de pricing a seguir
const pricingMetrics = {
  // Conversión
  trialToPaid: "> 10% es bueno",
  paidConversionRate: "> 5% es bueno",

  // Churn
  monthlyChurn: "< 3% es excelente",
  annualChurn: "< 30% es aceptable",

  // Revenue
  arpu: "Average Revenue Per User",
  ltv: "Lifetime Value (debería ser > 10x CAC)",

  // Engagement
  featureAdoption: "> 60% usando features de pago",
  upgradeRate: "> 5% haciendo upgrade/mes"
};
```

### Respuesta ante Objeciones de Precio

| Objeción | Respuesta sugerida |
|----------|-------------------|
| "Muy caro" | Ofrecer plan inferior o pago anual con descuento |
| "No puedo pagar ahora" | trial extendido, o plan más básico |
| "Mi competencia es más barato" | Destacar diferenciadores únicos |
| "Necesito tiempo" | Offer lock-in al precio actual por 6-12 meses |

### Checklist de Ajuste de Precios

#### Pre-ajuste
- [ ] Analizar métricas de los últimos 3 meses
- [ ] Comparar con competencia
- [ ] Calcular nuevo precio con fórmula
- [ ] Preparar comunicación para clientes
- [ ] Decidir: nuevos vs existentes

#### Post-ajuste (30 días después)
- [ ] Medir impacto en conversión
- [ ] Medir impacto en churn
- [ ] Recoger feedback de clientes
- [ ] Ajustar si es necesario

---

## Fuentes de Investigación

- Alegra POS: https://www.alegra.com/mexico/pos/precios/
- Pos Ferretería: https://posferreteria.com/
- FPOS: https://ferrepos.com/
- Ferrefy: https://ferrefy.app/
- Kladi: https://www.kladi.mx/
- Ferretero: https://ferretero.pe/
- IntiFact: https://intifact.com/pricing
- GridPOS: https://gridpos.co/software-pos-para-ferreterias
- Saas Pricing Benchmark 2025: https://www.getmonetizely.com/
- SMB Software Spend Report 2026: https://mewayz.cloud/
- Treinta Blog: https://www.treinta.co/blog/
- El Financiero Costa Rica: https://www.elfinancierocr.com/