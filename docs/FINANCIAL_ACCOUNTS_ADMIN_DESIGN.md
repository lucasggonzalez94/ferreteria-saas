# Diseño de Administración de Cuentas Financieras

## 📋 REQUERIMIENTOS

1. **CRUD de Cuentas Financieras**
   - Crear nuevas cuentas (Banco, Billetera, Tarjeta de Crédito)
   - Editar cuentas existentes
   - Activar/desactivar cuentas
   - Ver listado de todas las cuentas con balances

2. **Transferencias entre Cuentas**
   - Transferir dinero entre cualquier par de cuentas
   - Validar fondos disponibles
   - Registrar descripción y notas
   - Historial de transferencias

3. **Movimientos Manuales**
   - Registrar ingresos/egresos manuales
   - Ajustes de balance
   - Correcciones

4. **Permisos y Roles**
   - Control de acceso granular
   - Auditoría de cambios

---

## 🎨 DISEÑO DE UI

### 1. Página Principal: Gestión de Cuentas
**Ruta:** `/dashboard/financial-accounts`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Cuentas Financieras                          [+ Nueva Cuenta]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ RESUMEN GENERAL                                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ Total Efectivo│ │ Total Bancos │ │ Total Virtual│         │
│ │   $15,000    │ │  $100,000    │ │   $5,000     │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                              │
│ CUENTAS ACTIVAS                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 💵 Caja Principal (CASH)                               │  │
│ │    Balance: $15,000.00                    [Editar] [Ver]│  │
│ │    ⭐ Cuenta por defecto                                │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 🏦 Banco Nación - Cta 1234567890 (BANK)               │  │
│ │    Balance: $100,000.00                   [Editar] [Ver]│  │
│ │    ⭐ Cuenta por defecto                                │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 💳 MercadoPago (WALLET)                                │  │
│ │    Balance: $5,000.00                     [Editar] [Ver]│  │
│ │    ⭐ Cuenta por defecto                                │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ [Transferir entre Cuentas] [Registrar Movimiento Manual]    │
└─────────────────────────────────────────────────────────────┘
```

**Características:**
- Cards con información de cada cuenta
- Indicador visual de cuenta por defecto
- Balance actualizado en tiempo real
- Filtros por tipo de cuenta
- Búsqueda por nombre

---

### 2. Modal: Nueva Cuenta
**Trigger:** Botón "+ Nueva Cuenta"

**Campos:**
```
┌─────────────────────────────────────────┐
│ Crear Nueva Cuenta Financiera           │
├─────────────────────────────────────────┤
│                                         │
│ Tipo de Cuenta *                        │
│ [Seleccionar ▼]                         │
│ • Efectivo (CASH)                       │
│ • Cuenta Bancaria (BANK)                │
│ • Billetera Virtual (WALLET)            │
│ • Tarjeta de Crédito (CREDIT_CARD)      │
│                                         │
│ Nombre *                                │
│ [_____________________________]         │
│                                         │
│ Descripción                             │
│ [_____________________________]         │
│                                         │
│ Moneda                                  │
│ [ARS ▼]                                 │
│                                         │
│ Balance Inicial                         │
│ [0.00_________________________]         │
│                                         │
│ ☑ Marcar como cuenta por defecto       │
│                                         │
│ --- Si es Cuenta Bancaria ---           │
│ Nombre del Banco                        │
│ [_____________________________]         │
│                                         │
│ Número de Cuenta                        │
│ [_____________________________]         │
│                                         │
│ --- Si es Billetera Virtual ---         │
│ Proveedor                               │
│ [Seleccionar ▼]                         │
│ • MercadoPago                           │
│ • Ualá                                  │
│ • Naranja X                             │
│ • Otro                                  │
│                                         │
│         [Cancelar]  [Crear Cuenta]      │
└─────────────────────────────────────────┘
```

---

### 3. Modal: Transferir entre Cuentas
**Trigger:** Botón "Transferir entre Cuentas"

**Campos:**
```
┌─────────────────────────────────────────┐
│ Transferir Dinero                       │
├─────────────────────────────────────────┤
│                                         │
│ Cuenta Origen *                         │
│ [Banco Nación - $100,000 ▼]            │
│                                         │
│ Cuenta Destino *                        │
│ [MercadoPago - $5,000 ▼]               │
│                                         │
│ Monto *                                 │
│ [_____________________________]         │
│ 💡 Disponible: $100,000.00              │
│                                         │
│ Descripción                             │
│ [_____________________________]         │
│                                         │
│ Notas                                   │
│ [_____________________________]         │
│ [_____________________________]         │
│                                         │
│         [Cancelar]  [Transferir]        │
└─────────────────────────────────────────┘
```

**Validaciones:**
- No permitir transferir a la misma cuenta
- Validar fondos disponibles en cuenta origen
- Mostrar balance actualizado después de transferencia

---

### 4. Modal: Movimiento Manual
**Trigger:** Botón "Registrar Movimiento Manual"

**Campos:**
```
┌─────────────────────────────────────────┐
│ Registrar Movimiento Manual             │
├─────────────────────────────────────────┤
│                                         │
│ Cuenta *                                │
│ [Banco Nación - $100,000 ▼]            │
│                                         │
│ Tipo de Movimiento *                    │
│ ○ Ingreso                               │
│ ○ Egreso                                │
│                                         │
│ Monto *                                 │
│ [_____________________________]         │
│ 💡 Balance actual: $100,000.00          │
│                                         │
│ Descripción *                           │
│ [_____________________________]         │
│                                         │
│ Notas                                   │
│ [_____________________________]         │
│ [_____________________________]         │
│                                         │
│         [Cancelar]  [Registrar]         │
└─────────────────────────────────────────┘
```

---

### 5. Página: Detalle de Cuenta
**Ruta:** `/dashboard/financial-accounts/:id`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ ← Volver    Banco Nación - Cta 1234567890                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ INFORMACIÓN DE LA CUENTA                                     │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ Tipo: Cuenta Bancaria (BANK)                         │    │
│ │ Balance Actual: $100,000.00                          │    │
│ │ Estado: ✓ Activa                                     │    │
│ │ Cuenta por defecto: ⭐ Sí                            │    │
│ │                                                      │    │
│ │ Banco: Banco Nación                                  │    │
│ │ Número de Cuenta: 1234567890                         │    │
│ │                                                      │    │
│ │ Creada: 15/02/2026                                   │    │
│ │ Última actualización: 16/02/2026                     │    │
│ │                                                      │    │
│ │              [Editar Cuenta]  [Desactivar]           │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ MOVIMIENTOS RECIENTES                                        │
│ [Filtros: Tipo ▼] [Período ▼] [Buscar...]                  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 16/02/2026 10:30 | Venta #123 (INCOME)                │  │
│ │ +$5,000.00                        Balance: $105,000.00 │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 16/02/2026 09:00 | Transferencia a Caja (TRANSFER)    │  │
│ │ -$10,000.00                       Balance: $100,000.00 │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 15/02/2026 14:00 | Pago Proveedor #45 (EXPENSE)       │  │
│ │ -$8,000.00                        Balance: $110,000.00 │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ [Ver más movimientos]                                        │
└─────────────────────────────────────────────────────────────┘
```

---

### 6. Integración con Caja
**Modificar:** `/dashboard/cash-register/page.tsx`

**Al Abrir Caja:**
```
┌─────────────────────────────────────────┐
│ Abrir Caja                              │
├─────────────────────────────────────────┤
│                                         │
│ Monto Inicial *                         │
│ [_____________________________]         │
│                                         │
│ Cuenta Origen (opcional)                │
│ [Banco Nación - $100,000 ▼]            │
│ ○ No transferir (dinero ya en caja)    │
│                                         │
│ 💡 Si seleccionas una cuenta, se        │
│    transferirá el monto desde esa       │
│    cuenta a la Caja Principal           │
│                                         │
│         [Cancelar]  [Abrir Caja]        │
└─────────────────────────────────────────┘
```

**Al Cerrar Caja:**
```
┌─────────────────────────────────────────┐
│ Cerrar Caja                             │
├─────────────────────────────────────────┤
│                                         │
│ Monto Esperado: $29,000.00              │
│                                         │
│ Monto Contado *                         │
│ [_____________________________]         │
│                                         │
│ Diferencia: $0.00 ✓                     │
│                                         │
│ Cuenta Destino (opcional)               │
│ [Banco Nación - $100,000 ▼]            │
│ ○ Dejar en caja                         │
│                                         │
│ 💡 Si seleccionas una cuenta, se        │
│    transferirá el efectivo desde la     │
│    Caja Principal a esa cuenta          │
│                                         │
│ Notas                                   │
│ [_____________________________]         │
│                                         │
│         [Cancelar]  [Cerrar Caja]       │
└─────────────────────────────────────────┘
```

---

## 🔐 PERMISOS Y ROLES

### Nuevos Permisos
```typescript
// Cuentas Financieras
'financial_accounts:create'  // Crear cuentas
'financial_accounts:read'    // Ver cuentas y balances
'financial_accounts:update'  // Editar cuentas
'financial_accounts:delete'  // Desactivar cuentas
'financial_accounts:manage'  // Gestión completa

// Movimientos Financieros
'financial_movements:create' // Crear movimientos/transferencias
'financial_movements:read'   // Ver movimientos
'financial_movements:manage' // Gestión completa
```

### Asignación por Rol

**OWNER:**
- Todos los permisos de financial_accounts
- Todos los permisos de financial_movements

**ADMIN:**
- financial_accounts:read
- financial_accounts:update
- financial_movements:create
- financial_movements:read

**CASHIER:**
- financial_accounts:read (solo para ver balances)
- financial_movements:read (solo sus propios movimientos)

**SELLER:**
- Sin permisos (no necesita acceso directo)

---

## 📊 NAVEGACIÓN

### Menú Principal
```
Dashboard
├─ Ventas
├─ Productos
├─ Inventario
├─ Compras
├─ Proveedores
├─ Clientes
├─ Caja
├─ 💰 Finanzas (NUEVO)
│  ├─ Cuentas Financieras
│  ├─ Movimientos
│  └─ Reportes
└─ Configuración
```

---

## 🎯 FUNCIONALIDADES CLAVE

### 1. Dashboard de Cuentas
- Resumen visual de balances por tipo
- Gráfico de evolución de balances
- Alertas de cuentas con balance bajo
- Últimos movimientos globales

### 2. Transferencias Inteligentes
- Sugerencias de transferencias frecuentes
- Validación en tiempo real
- Confirmación con resumen
- Notificación de éxito

### 3. Conciliación Bancaria
- Importar extracto bancario (futuro)
- Comparar con movimientos registrados
- Marcar movimientos como conciliados

### 4. Reportes
- Balance por cuenta en fecha específica
- Flujo de caja por período
- Movimientos por tipo
- Exportar a Excel/PDF

---

## 🔄 FLUJO DE TRABAJO TÍPICO

### Escenario 1: Apertura de Negocio
```
1. Usuario crea cuenta "Banco Nación" con balance inicial $100,000
2. Usuario crea cuenta "Caja Principal" con balance $0
3. Usuario abre caja y transfiere $10,000 desde Banco a Caja
4. Sistema registra:
   - Movimiento EXPENSE en Banco (-$10,000)
   - Movimiento INCOME en Caja (+$10,000)
```

### Escenario 2: Venta del Día
```
1. Venta en efectivo $5,000 → Caja Principal (+$5,000)
2. Venta con transferencia $3,000 → Banco Nación (+$3,000)
3. Venta con QR $2,000 → MercadoPago (+$2,000)
4. Al cerrar caja, usuario transfiere efectivo a Banco
```

### Escenario 3: Pago a Proveedor
```
1. Usuario registra compra de $50,000
2. Paga $20,000 con transferencia
3. Sistema valida fondos en Banco Nación
4. Registra movimiento EXPENSE en Banco (-$20,000)
5. Saldo pendiente: $30,000
```

---

## 📱 RESPONSIVE DESIGN

- Diseño mobile-first
- Cards apiladas en móvil
- Modales adaptables
- Tablas con scroll horizontal
- Acciones rápidas en móvil

---

## 🚀 IMPLEMENTACIÓN PROPUESTA

### Fase 1: Backend (YA COMPLETADO ✓)
- Modelos y servicios
- API endpoints
- Validaciones

### Fase 2: UI Base (PRÓXIMO)
1. Página de listado de cuentas
2. Modal crear/editar cuenta
3. Modal transferencias
4. Modal movimientos manuales

### Fase 3: Integración (PRÓXIMO)
1. Actualizar UI de caja
2. Agregar permisos al seed
3. Agregar menú "Finanzas"

### Fase 4: Mejoras (FUTURO)
1. Dashboard con gráficos
2. Reportes avanzados
3. Conciliación bancaria
4. Exportación de datos

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Agregar permisos al seed
- [ ] Crear página `/dashboard/financial-accounts`
- [ ] Implementar listado de cuentas
- [ ] Implementar modal crear cuenta
- [ ] Implementar modal editar cuenta
- [ ] Implementar modal transferencias
- [ ] Implementar modal movimientos manuales
- [ ] Implementar página de detalle de cuenta
- [ ] Actualizar UI de caja con selectores
- [ ] Agregar menú "Finanzas"
- [ ] Probar flujo completo
- [ ] Documentar para usuarios

---

¿Te parece bien este diseño? ¿Hay algo que quieras modificar antes de que comience la implementación?
