# Progreso de Implementación - Sistema de Cuentas Financieras

## ✅ COMPLETADO (Backend Core)

### 1. Modelos de Base de Datos
- ✅ **FinancialAccount**: Modelo para cuentas financieras (CASH, BANK, WALLET, CREDIT_CARD)
- ✅ **FinancialMovement**: Modelo para movimientos financieros (INCOME, EXPENSE, TRANSFER)
- ✅ **Migration**: Generada y aplicada exitosamente
- ✅ **Seed**: Cuentas por defecto creadas (Caja Principal, Cuenta Bancaria, MercadoPago)

### 2. Servicios Backend
- ✅ **FinancialAccountService**: CRUD completo de cuentas financieras
  - Listar cuentas
  - Obtener cuenta por ID
  - Obtener cuenta por defecto de un tipo
  - Crear cuenta
  - Actualizar cuenta
  - Validar fondos disponibles
  - Actualizar balance
  - Obtener resumen de balances

- ✅ **FinancialMovementService**: Gestión de movimientos financieros
  - Crear movimiento (INCOME/EXPENSE)
  - Crear transferencia entre cuentas
  - Listar movimientos por cuenta
  - Obtener resumen de movimientos
  - Mapeo de métodos de pago a tipos de cuenta

### 3. Integración con Flujos Existentes

#### ✅ SaleService (Ventas)
**Cambios implementados:**
- Al confirmar una venta, por cada pago:
  - Determina el tipo de cuenta según método de pago
  - Obtiene cuenta por defecto del tipo
  - Actualiza balance de la cuenta
  - Crea movimiento financiero con sourceType='SALE'

**Resultado:**
- Ventas con CASH_ARS → Incrementa balance de "Caja Principal"
- Ventas con TRANSFER → Incrementa balance de "Cuenta Bancaria"
- Ventas con QR → Incrementa balance de "MercadoPago"
- Ventas con ACCOUNT → No afecta cuentas financieras (cuenta corriente cliente)

#### ✅ PurchaseService (Compras)
**Cambios implementados:**
- Agregado parámetro `paymentMethod` (CASH, TRANSFER, CHECK)
- Al crear compra con pago inicial:
  - Valida fondos disponibles en cuenta (excepto CHECK)
  - Registra pago con método específico
  - Llama a PayableService.recordPayment con el método

**Resultado:**
- Compras ahora soportan múltiples métodos de pago
- Validación de fondos antes de registrar pago

#### ✅ PayableService (Pagos a Proveedores)
**Cambios implementados:**
- Al registrar pago a proveedor:
  - Valida fondos disponibles en cuenta (excepto CHECK)
  - Actualiza balance de la cuenta
  - Crea movimiento financiero con sourceType='SUPPLIER_PAYMENT'

**Resultado:**
- Pagos en CASH → Descuenta de "Caja Principal"
- Pagos en TRANSFER → Descuenta de "Cuenta Bancaria"
- Pagos en CHECK → No descuenta inmediatamente (se registra cuando se cobra)

---

## 🚧 PENDIENTE

### 1. Backend - CashRegisterService
**Modificaciones necesarias:**
- Abrir caja: Crear transferencia desde cuenta origen (BANK/WALLET) a Caja
- Cerrar caja: Crear transferencia desde Caja a cuenta destino
- Incluir todos los métodos de pago en cálculo de monto esperado

### 2. Backend - API Endpoints
**Crear rutas para:**
- `GET /financial-accounts` - Listar cuentas
- `GET /financial-accounts/:id` - Obtener cuenta
- `POST /financial-accounts` - Crear cuenta
- `PUT /financial-accounts/:id` - Actualizar cuenta
- `GET /financial-accounts/summary` - Resumen de balances
- `GET /financial-movements` - Listar movimientos
- `GET /financial-movements/summary` - Resumen de movimientos
- `POST /financial-movements/transfer` - Crear transferencia

### 3. Backend - Schemas de Validación
**Crear schemas Zod para:**
- createFinancialAccountSchema
- updateFinancialAccountSchema
- createTransferSchema
- listMovementsSchema

### 4. Frontend - UI de Compras
**Modificar:** `ferresaas-web/app/dashboard/purchases/new/page.tsx`
- Agregar selector de método de pago (CASH, TRANSFER, CHECK)
- Mostrar balance disponible de la cuenta seleccionada
- Validar fondos antes de enviar

### 5. Frontend - UI de Caja
**Modificar:** `ferresaas-web/app/dashboard/cash-register/page.tsx`
- Al abrir caja:
  - Selector de cuenta origen (Banco, Billetera)
  - Mostrar balance disponible
  - Crear transferencia a Caja
- Al cerrar caja:
  - Selector de cuenta destino
  - Mostrar resumen de todos los métodos de pago
  - Crear transferencia desde Caja

### 6. Frontend - UI de Pagos a Proveedores
**Crear/Modificar:** Página de pagos a proveedores
- Selector de método de pago
- Validación de fondos
- Mostrar balance disponible

### 7. Frontend - Gestión de Cuentas Financieras
**Crear:** `ferresaas-web/app/dashboard/financial-accounts/page.tsx`
- Listar cuentas financieras
- Ver balance de cada cuenta
- Crear nueva cuenta
- Editar cuenta existente
- Ver movimientos de una cuenta
- Crear transferencia entre cuentas

### 8. Frontend - Reportes
**Crear:** Reportes de flujo de caja
- Movimientos por cuenta
- Resumen por período
- Balance por tipo de cuenta
- Conciliación bancaria

---

## 📊 ARQUITECTURA IMPLEMENTADA

### Flujo de Dinero en Ventas
```
Cliente paga $10,000
├─ CASH_ARS ($6,000)
│  └─ FinancialMovement: INCOME en "Caja Principal"
│     Balance: $0 → $6,000
│
├─ TRANSFER ($3,000)
│  └─ FinancialMovement: INCOME en "Cuenta Bancaria"
│     Balance: $100,000 → $103,000
│
└─ QR ($1,000)
   └─ FinancialMovement: INCOME en "MercadoPago"
      Balance: $0 → $1,000
```

### Flujo de Dinero en Compras
```
Compra de $50,000 con pago inicial de $20,000
├─ Método: TRANSFER
│  ├─ Validar fondos en "Cuenta Bancaria" (balance: $103,000)
│  ├─ FinancialMovement: EXPENSE en "Cuenta Bancaria"
│  │  Balance: $103,000 → $83,000
│  └─ SupplierPayment creado con method='TRANSFER'
│
└─ Saldo pendiente: $30,000
   └─ SupplierPayable creado
```

### Flujo de Caja (Pendiente)
```
ABRIR CAJA:
1. Seleccionar cuenta origen: "Cuenta Bancaria"
2. Monto a transferir: $10,000
3. Validar fondos (balance: $83,000)
4. Crear transferencia:
   ├─ FinancialMovement: EXPENSE en "Cuenta Bancaria"
   │  Balance: $83,000 → $73,000
   └─ FinancialMovement: INCOME en "Caja Principal"
      Balance: $6,000 → $16,000
5. Abrir CashRegisterSession con openingAmount=$16,000

CERRAR CAJA:
1. Contar efectivo: $20,000
2. Monto esperado: $16,000 (opening) + ventas - gastos
3. Diferencia: $20,000 - esperado
4. Seleccionar cuenta destino: "Cuenta Bancaria"
5. Crear transferencia:
   ├─ FinancialMovement: EXPENSE en "Caja Principal"
   │  Balance: $20,000 → $0
   └─ FinancialMovement: INCOME en "Cuenta Bancaria"
      Balance: $73,000 → $93,000
```

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

1. **Modificar CashRegisterService** para transferencias
2. **Crear endpoints API** para cuentas financieras
3. **Actualizar UI de compras** con selector de método de pago
4. **Actualizar UI de caja** con selector de cuenta
5. **Crear UI de gestión** de cuentas financieras
6. **Probar flujo completo** end-to-end

---

## 📝 NOTAS TÉCNICAS

### Validación de Fondos
- Se valida antes de crear el movimiento
- Lanza error `INSUFFICIENT_FUNDS` si no hay fondos
- Excepción: CHECK (se registra pero no descuenta inmediatamente)

### Balance Snapshot
- Cada movimiento guarda `balanceAfter` para auditoría
- Permite reconstruir historial de balances

### Mapeo de Métodos de Pago
```typescript
CASH_ARS → CASH
CASH_USD → CASH
TRANSFER → BANK
CARD → BANK
QR → WALLET
ACCOUNT → null (no afecta cuentas financieras)
```

### Tipos de Movimientos
- **INCOME**: Ingreso a la cuenta
- **EXPENSE**: Egreso de la cuenta
- **TRANSFER**: Transferencia entre cuentas (crea 2 movimientos)

