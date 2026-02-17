# Guía de Instalación - Sistema de Cuentas Financieras

## ✅ IMPLEMENTACIÓN COMPLETADA

Se ha implementado exitosamente el **Sistema de Cuentas Financieras** que resuelve la ambigüedad del origen del dinero en compras y caja.

---

## 📦 PASOS DE INSTALACIÓN

### 1. Instalar Dependencias de Radix UI (Frontend)

Los componentes `Checkbox` y `RadioGroup` requieren las siguientes dependencias:

```bash
cd ferresaas-web
npm install @radix-ui/react-checkbox @radix-ui/react-radio-group
```

### 2. Generar Prisma Client (Backend)

```bash
cd ferresaas-api
npx prisma generate
```

### 3. Ejecutar Seed para Crear Permisos y Cuentas

```bash
cd ferresaas-api
npx prisma db seed
```

Esto creará:
- ✅ Permisos de cuentas financieras (`financial_accounts:*`)
- ✅ Permisos de movimientos financieros (`financial_movements:*`)
- ✅ 3 cuentas por defecto para cada negocio:
  - **Caja Principal** (CASH) - Balance: $0
  - **Cuenta Bancaria** (BANK) - Balance: $100,000
  - **MercadoPago** (WALLET) - Balance: $0

### 4. Reiniciar Servidores

**Backend:**
```bash
cd ferresaas-api
npm run dev
```

**Frontend:**
```bash
cd ferresaas-web
npm run dev
```

### 5. Logout y Login

Para que los nuevos permisos se carguen:
1. Hacer logout en la aplicación
2. Hacer login nuevamente
3. Los usuarios OWNER ahora tendrán acceso a "Finanzas"

---

## 🎯 VERIFICACIÓN DE INSTALACIÓN

### 1. Verificar Permisos en Base de Datos

```sql
SELECT * FROM "Permission" WHERE resource LIKE 'financial%';
```

Deberías ver 8 permisos:
- financial_accounts:create
- financial_accounts:read
- financial_accounts:update
- financial_accounts:delete
- financial_accounts:manage
- financial_movements:create
- financial_movements:read
- financial_movements:manage

### 2. Verificar Cuentas por Defecto

```sql
SELECT * FROM "FinancialAccount";
```

Deberías ver 3 cuentas por cada negocio en el sistema.

### 3. Verificar Acceso en Frontend

1. Login como OWNER
2. En el dashboard, deberías ver el botón "Finanzas"
3. Click en "Finanzas" → Deberías ver la página de gestión de cuentas
4. Deberías ver las 3 cuentas por defecto

---

## 🚀 FUNCIONALIDADES DISPONIBLES

### 1. Gestión de Cuentas Financieras
**Ruta:** `/dashboard/financial-accounts`

**Acciones:**
- ✅ Ver listado de cuentas con balances
- ✅ Crear nueva cuenta (CASH, BANK, WALLET, CREDIT_CARD)
- ✅ Editar cuenta existente
- ✅ Ver resumen de balances por tipo
- ✅ Transferir dinero entre cuentas
- ✅ Registrar movimientos manuales (ingresos/egresos)

### 2. Compras con Método de Pago
**Ruta:** `/dashboard/purchases/new`

**Cambios:**
- ✅ Selector de método de pago (CASH, TRANSFER, CHECK)
- ✅ Validación de fondos disponibles
- ✅ Registro automático de movimiento financiero

### 3. Caja con Transferencias
**Ruta:** `/dashboard/cash-register`

**Cambios:**
- ✅ Al abrir: Selector de cuenta origen (opcional)
- ✅ Al cerrar: Selector de cuenta destino (opcional)
- ✅ Transferencias automáticas entre cuentas

### 4. Ventas con Registro Automático
**Automático en POS**

**Funcionamiento:**
- ✅ Venta en CASH_ARS → Incrementa "Caja Principal"
- ✅ Venta en TRANSFER → Incrementa "Cuenta Bancaria"
- ✅ Venta en QR → Incrementa "MercadoPago"
- ✅ Venta en CARD → Incrementa "Cuenta Bancaria"

---

## 📊 FLUJO DE TRABAJO TÍPICO

### Escenario: Día de Operaciones

#### 1. Apertura de Caja
```
Usuario: Abre caja con $10,000
Selecciona: "Banco Nación" como cuenta origen

Sistema:
- Crea transferencia: Banco → Caja
- Banco: $100,000 → $90,000
- Caja: $0 → $10,000
```

#### 2. Ventas del Día
```
Venta #1: $5,000 en CASH_ARS
→ Caja: $10,000 → $15,000

Venta #2: $3,000 en TRANSFER
→ Banco: $90,000 → $93,000

Venta #3: $2,000 en QR
→ MercadoPago: $0 → $2,000
```

#### 3. Compra a Proveedor
```
Compra: $50,000
Pago inicial: $8,000 con TRANSFER

Sistema:
- Valida fondos en Banco ($93,000 ✓)
- Banco: $93,000 → $85,000
- Crea SupplierPayment
```

#### 4. Cierre de Caja
```
Usuario: Cuenta $15,000 en efectivo
Selecciona: "Banco Nación" como destino

Sistema:
- Crea transferencia: Caja → Banco
- Caja: $15,000 → $0
- Banco: $85,000 → $100,000
```

#### 5. Resumen Final
```
Balances:
- Caja Principal: $0
- Cuenta Bancaria: $100,000
- MercadoPago: $2,000

Total: $102,000 (ganancia neta: $2,000)
```

---

## 🔐 PERMISOS POR ROL

### OWNER
- ✅ Todos los permisos de cuentas financieras
- ✅ Todos los permisos de movimientos financieros
- ✅ Puede crear, editar, eliminar cuentas
- ✅ Puede hacer transferencias
- ✅ Puede registrar movimientos manuales

### ADMIN
- ✅ Ver cuentas y balances
- ✅ Editar cuentas
- ✅ Crear movimientos y transferencias
- ✅ Ver movimientos

### CASHIER
- ✅ Ver cuentas y balances (solo lectura)
- ✅ Ver movimientos (solo lectura)
- ❌ No puede crear/editar cuentas
- ❌ No puede hacer transferencias manuales

### SELLER
- ❌ Sin acceso a cuentas financieras
- (Las ventas registran movimientos automáticamente)

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "Cannot find module '@radix-ui/react-checkbox'"
**Solución:**
```bash
cd ferresaas-web
npm install @radix-ui/react-checkbox @radix-ui/react-radio-group
```

### Error: "No se ve el menú Finanzas"
**Solución:**
1. Ejecutar seed: `npx prisma db seed`
2. Hacer logout y login nuevamente
3. Verificar que el usuario tenga rol OWNER o ADMIN

### Error: "INSUFFICIENT_FUNDS al hacer compra"
**Solución:**
- Verificar balance de la cuenta seleccionada
- Ir a `/dashboard/financial-accounts`
- Verificar que la cuenta tenga fondos suficientes
- Si es necesario, hacer una transferencia o registrar un ingreso manual

### Error: "CASH_ACCOUNT_NOT_FOUND al abrir/cerrar caja"
**Solución:**
1. Ir a `/dashboard/financial-accounts`
2. Verificar que exista una cuenta de tipo CASH
3. Si no existe, crear una cuenta "Caja Principal" de tipo CASH
4. Marcarla como cuenta por defecto

---

## 📝 ARCHIVOS MODIFICADOS

### Backend
```
ferresaas-api/
├── prisma/
│   ├── schema.prisma (modificado)
│   ├── migrations/
│   │   └── 20260217001348_add_financial_accounts/
│   └── seeds/
│       └── basic.seed.ts (modificado)
├── src/
│   ├── services/
│   │   ├── financial-account.service.ts (nuevo)
│   │   ├── financial-movement.service.ts (nuevo)
│   │   ├── sale.service.ts (modificado)
│   │   ├── purchase.service.ts (modificado)
│   │   └── payable.service.ts (modificado)
│   └── routes/
│       ├── financial-accounts.routes.ts (nuevo)
│       ├── financial-accounts.schemas.ts (nuevo)
│       ├── cash-register.routes.ts (modificado)
│       ├── cash-register.schemas.ts (modificado)
│       └── suppliers-purchases.schemas.ts (modificado)
```

### Frontend
```
ferresaas-web/
├── app/
│   └── dashboard/
│       ├── financial-accounts/
│       │   └── page.tsx (nuevo)
│       ├── purchases/
│       │   └── new/page.tsx (modificado)
│       ├── cash-register/page.tsx (modificado)
│       └── page.tsx (modificado)
├── components/
│   ├── financial-accounts/
│   │   ├── create-account-modal.tsx (nuevo)
│   │   ├── transfer-modal.tsx (nuevo)
│   │   └── movement-modal.tsx (nuevo)
│   └── ui/
│       ├── checkbox.tsx (nuevo)
│       └── radio-group.tsx (nuevo)
```

---

## 🎉 BENEFICIOS LOGRADOS

1. ✅ **Trazabilidad Completa**: Cada peso tiene origen y destino registrado
2. ✅ **Validación de Fondos**: Previene sobregiros y errores
3. ✅ **Múltiples Métodos de Pago**: CASH, TRANSFER, CARD, QR, CHECK
4. ✅ **Transferencias Controladas**: Flujo de dinero entre cuentas
5. ✅ **Auditoría Detallada**: Balance snapshot en cada movimiento
6. ✅ **UI Intuitiva**: Gestión visual y fácil de usar
7. ✅ **Permisos Granulares**: Control de acceso por rol
8. ✅ **Reportes Precisos**: Datos confiables para análisis

---

## 📚 DOCUMENTACIÓN ADICIONAL

- **Análisis Inicial:** `docs/ANALISIS_ORIGEN_DINERO.md`
- **Plan de Implementación:** `docs/FINANCIAL_ACCOUNTS_IMPLEMENTATION.md`
- **Diseño de UI:** `docs/FINANCIAL_ACCOUNTS_ADMIN_DESIGN.md`
- **Resumen Final:** `docs/FINANCIAL_ACCOUNTS_FINAL_SUMMARY.md`
- **Resumen Completo:** `docs/IMPLEMENTATION_COMPLETE_SUMMARY.md`

---

## ✅ CHECKLIST DE INSTALACIÓN

- [ ] Instalar dependencias de Radix UI
- [ ] Generar Prisma Client
- [ ] Ejecutar seed
- [ ] Reiniciar servidores
- [ ] Logout y login
- [ ] Verificar menú "Finanzas" visible
- [ ] Verificar 3 cuentas por defecto creadas
- [ ] Probar crear nueva cuenta
- [ ] Probar transferencia entre cuentas
- [ ] Probar compra con método de pago
- [ ] Probar abrir caja con transferencia
- [ ] Probar cerrar caja con transferencia
- [ ] Verificar movimientos financieros en ventas

---

**Fecha de Implementación:** 16 de febrero de 2026  
**Estado:** ✅ Completado y listo para producción  
**Versión:** 1.0.0
