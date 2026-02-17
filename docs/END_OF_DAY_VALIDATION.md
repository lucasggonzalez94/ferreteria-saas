# Validación de Cierre de Día - Sistema de Cuentas Financieras

## 📋 Resumen

Al final de cada día, necesitas validar que el dinero en todas tus cuentas coincida con lo que registró el sistema. Este documento te guía paso a paso.

---

## 🎯 Dónde Visualizar las Cuentas

### **1. Resumen General de Cuentas**
**Ruta:** `/dashboard/financial-accounts/summary`

**Qué ves:**
- Balance total de todas las cuentas
- Balance individual de cada cuenta
- Movimientos del día por cuenta
- Ingresos y egresos del día

### **2. Gestión de Cuentas Detallada**
**Ruta:** `/dashboard/financial-accounts`

**Qué ves:**
- Listado completo de cuentas
- Opciones para crear/editar cuentas
- Botones para transferencias manuales
- Historial de movimientos

### **3. Detalle de Cuenta Individual**
**Ruta:** `/dashboard/financial-accounts/{accountId}`

**Qué ves:**
- Balance actual
- Historial completo de movimientos
- Gráficos de tendencia
- Exportar movimientos

---

## ✅ Proceso de Validación de Cierre de Día

### **Paso 1: Acceder al Resumen**

```
1. Dashboard → Finanzas → Resumen
   (o directamente: /dashboard/financial-accounts/summary)
2. Verás todas tus cuentas con sus balances actuales
```

### **Paso 2: Contar Dinero Físico**

Según el tipo de cuenta:

#### **Caja Principal (CASH)**
```
Acción:
1. Cuenta todo el efectivo físico en la caja
2. Anota el monto total

Validación:
✓ Efectivo contado = Balance de Caja Principal en el sistema
✓ Si no coincide, hay una diferencia que registrar
```

#### **Cuenta Bancaria (BANK)**
```
Acción:
1. Revisa tu extracto bancario
2. Verifica transferencias recibidas del día

Validación:
✓ Transferencias recibidas = Incremento en Banco
✓ Cheques pagados = Decremento en Banco
```

#### **Billetera Virtual (WALLET - MercadoPago, etc.)**
```
Acción:
1. Abre la app de MercadoPago/Ualá/etc.
2. Verifica el balance disponible

Validación:
✓ Balance en app = Balance en sistema
✓ Transacciones del día coinciden
```

### **Paso 3: Registrar Validación**

En la página de resumen, para cada cuenta:

```
1. Ve a "Reporte de Cierre de Día"
2. Para cada cuenta, ingresa el monto contado
3. El sistema compara automáticamente:
   - Monto contado vs Balance del sistema
   - Muestra diferencia si la hay
```

### **Paso 4: Resolver Diferencias**

Si hay diferencia:

#### **Diferencia Positiva (Contaste más de lo que dice el sistema)**
```
Ejemplo: Sistema dice $10,000 pero contaste $10,500

Posibles causas:
- Dinero que olvidó registrarse (efectivo encontrado)
- Error en un movimiento anterior

Solución:
1. Ve a Finanzas → Movimientos Manuales
2. Registra un INGRESO de $500
3. Descripción: "Ajuste de cierre - diferencia positiva"
4. Ahora cuadra
```

#### **Diferencia Negativa (Contaste menos de lo que dice el sistema)**
```
Ejemplo: Sistema dice $10,000 pero contaste $9,500

Posibles causas:
- Dinero que se perdió/robó
- Error en un movimiento anterior
- Cambio de dinero no registrado

Solución:
1. Ve a Finanzas → Movimientos Manuales
2. Registra un EGRESO de $500
3. Descripción: "Ajuste de cierre - diferencia negativa"
4. Ahora cuadra
```

---

## 📊 Flujo Completo de Validación

```
INICIO DEL DÍA
├── Abrir Caja: $10,000 en efectivo
├── Caja Principal: $10,000
├── Banco: $100,000
└── MercadoPago: $0

DURANTE EL DÍA
├── Venta #1: $5,000 CASH
│   └── Caja Principal: $10,000 → $15,000
├── Venta #2: $3,000 TRANSFER
│   └── Banco: $100,000 → $103,000
├── Venta #3: $2,000 QR
│   └── MercadoPago: $0 → $2,000
└── Compra: -$8,000 TRANSFER
    └── Banco: $103,000 → $95,000

CIERRE DEL DÍA - VALIDACIÓN
├── Caja Principal
│   ├── Balance Sistema: $15,000
│   ├── Conteo Físico: $15,000
│   └── ✓ CUADRA
├── Banco
│   ├── Balance Sistema: $95,000
│   ├── Extracto Bancario: $95,000
│   └── ✓ CUADRA
└── MercadoPago
    ├── Balance Sistema: $2,000
    ├── App MercadoPago: $2,000
    └── ✓ CUADRA

RESULTADO: TODO CUADRA ✓
```

---

## 🔍 Checklist de Validación

### **Antes de Cerrar la Caja**

- [ ] Accedí a `/dashboard/financial-accounts/summary`
- [ ] Anoté el balance de cada cuenta del sistema
- [ ] Conté el efectivo físico en la caja
- [ ] Revisé el extracto bancario
- [ ] Revisé el balance en MercadoPago/Ualá
- [ ] Comparé cada monto con el sistema
- [ ] Registré diferencias (si las hay)
- [ ] Todo cuadra ✓

### **Al Cerrar la Caja**

- [ ] Voy a `/dashboard/cash-register`
- [ ] Ingreso el monto contado en efectivo
- [ ] Hago click en "Cerrar Caja"
- [ ] El sistema compara con lo esperado
- [ ] Reviso el reporte de cierre

---

## 📈 Ejemplo Práctico Completo

### **Escenario: Día Normal**

```
MAÑANA - Apertura
├── Abro caja con $10,000 en efectivo
├── Sistema registra: Caja Principal = $10,000
├── Banco = $100,000 (saldo anterior)
└── MercadoPago = $0

MEDIODÍA - Operaciones
├── Cliente #1 paga $2,000 en CASH
│   └── Caja: $10,000 → $12,000
├── Cliente #2 paga $1,500 por TRANSFER
│   └── Banco: $100,000 → $101,500
├── Cliente #3 paga $500 por QR
│   └── MercadoPago: $0 → $500
└── Compra a proveedor: $3,000 TRANSFER
    └── Banco: $101,500 → $98,500

TARDE - Más operaciones
├── Cliente #4 paga $1,000 en CASH
│   └── Caja: $12,000 → $13,000
└── Venta por QR: $800
    └── MercadoPago: $500 → $1,300

CIERRE - Validación
├── Cuento efectivo: $13,000
│   ├── Sistema dice: $13,000
│   └── ✓ CUADRA
├── Reviso banco: $98,500
│   ├── Sistema dice: $98,500
│   └── ✓ CUADRA
├── Reviso MercadoPago: $1,300
│   ├── Sistema dice: $1,300
│   └── ✓ CUADRA
└── Cierro caja: TODO VALIDADO ✓

RESUMEN FINAL
├── Caja: $13,000
├── Banco: $98,500
├── MercadoPago: $1,300
└── TOTAL: $112,800 (ganancia: $2,800)
```

---

## 🚨 Problemas Comunes y Soluciones

### **Problema: Diferencia en Caja**

```
Sistema: $15,000
Conteo: $14,500
Diferencia: -$500

Soluciones:
1. Revisar si hay un movimiento manual sin registrar
2. Contar nuevamente (a veces hay errores)
3. Si confirma diferencia, registrar EGRESO de $500
4. Descripción: "Diferencia de caja - investigar"
```

### **Problema: Diferencia en Banco**

```
Sistema: $95,000
Extracto: $94,800
Diferencia: -$200

Soluciones:
1. Revisar si hay una transferencia pendiente
2. Revisar si hay comisiones bancarias no registradas
3. Si confirma diferencia, registrar EGRESO de $200
4. Descripción: "Comisión bancaria" o "Diferencia banco"
```

### **Problema: Diferencia en MercadoPago**

```
Sistema: $2,000
App: $1,900
Diferencia: -$100

Soluciones:
1. Revisar si hay comisiones de MercadoPago
2. Revisar si hay reembolsos pendientes
3. Si confirma diferencia, registrar EGRESO de $100
4. Descripción: "Comisión MercadoPago"
```

---

## 📱 Acciones Rápidas

### **Ver Resumen Rápido**
```
Dashboard → Finanzas → Resumen
(Muestra todos los balances en una pantalla)
```

### **Ver Movimientos del Día**
```
Finanzas → Resumen → Sección "Movimientos del Día"
(Filtra por fecha, muestra todos los movimientos)
```

### **Registrar Diferencia**
```
Finanzas → Movimientos Manuales
(Registra INGRESO o EGRESO para ajustar)
```

### **Cerrar Caja**
```
Caja → Cerrar Caja
(Ingresa monto contado, sistema valida)
```

---

## ✅ Validación Exitosa

Cuando todo cuadra:

```
✓ Efectivo contado = Caja Principal
✓ Transferencias = Banco
✓ QR/Billeteras = MercadoPago
✓ Todas las cuentas validadas
✓ Puedes cerrar la caja con confianza
```

---

## 📞 Soporte

Si tienes dudas:

1. **¿Cómo veo todas las cuentas?**
   → Ve a `/dashboard/financial-accounts/summary`

2. **¿Cómo registro una diferencia?**
   → Finanzas → Movimientos Manuales → Registra INGRESO o EGRESO

3. **¿Qué pasa si no cuadra?**
   → Registra la diferencia y investiga después

4. **¿Puedo cerrar caja si hay diferencia?**
   → Sí, pero primero registra la diferencia en Movimientos Manuales
