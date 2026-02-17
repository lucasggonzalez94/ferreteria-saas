# Implementación de Cuentas Financieras - Plan Completo

## 1. PROBLEMA ADICIONAL IDENTIFICADO

Además de los problemas originales, existe un **problema crítico en el flujo de ventas**:

### Ventas con métodos NO-CASH
- Las ventas con TRANSFER, CARD, QR **no modifican la caja**
- Se registran en la tabla `Payment` pero **no hay trazabilidad** de dónde está ese dinero
- Al cerrar la caja, **no hay forma de auditar** estos pagos
- **No se puede conciliar** con extractos bancarios o terminales de pago

**Ejemplo:**
```
Venta de $10,000 pagada con TRANSFER
- Se registra el pago en Payment.method = 'TRANSFER'
- NO se descuenta de ninguna cuenta bancaria
- NO se crea movimiento financiero
- Al cerrar caja: ¿dónde está ese dinero?
```

---

## 2. SOLUCIÓN: MODELO COMPLETO DE CUENTAS FINANCIERAS

### 2.1 Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                    CUENTAS FINANCIERAS                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Caja Efectivo│  │ Banco Nación │  │ MercadoPago  │      │
│  │ Balance: $X  │  │ Balance: $Y  │  │ Balance: $Z  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ▲                 ▲                 ▲               │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                 │
│                  MOVIMIENTOS FINANCIEROS                    │
│                                                              │
│  • Venta en efectivo → Caja Efectivo (+)                   │
│  • Venta con transferencia → Banco Nación (+)              │
│  • Venta con QR → MercadoPago (+)                          │
│  • Compra pagada en efectivo → Caja Efectivo (-)           │
│  • Compra pagada con transferencia → Banco Nación (-)      │
│  • Abrir caja → Transferir de Banco a Caja                 │
│  • Cerrar caja → Transferir de Caja a Banco                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Modelos Prisma

```prisma
// Tipos de cuentas financieras
enum FinancialAccountType {
  CASH           // Caja física (efectivo)
  BANK           // Cuenta bancaria
  WALLET         // Billetera virtual (MercadoPago, etc.)
  CREDIT_CARD    // Tarjeta de crédito empresarial
}

// Tipos de movimientos financieros
enum FinancialMovementType {
  INCOME         // Ingreso
  EXPENSE        // Egreso
  TRANSFER       // Transferencia entre cuentas
}

// Cuenta financiera
model FinancialAccount {
  id          String   @id @default(cuid())
  businessId  String
  
  type        FinancialAccountType
  name        String   // "Caja Principal", "Banco Nación Cta 123", "MercadoPago"
  description String?
  currency    String   @default("ARS")
  
  // Balance actual (calculado)
  balance     Decimal  @db.Decimal(12, 2) @default(0)
  
  // Configuración
  isDefault   Boolean  @default(false) // Cuenta por defecto para cada tipo
  isActive    Boolean  @default(true)
  
  // Metadata específica por tipo
  bankName    String?  // Para BANK
  accountNumber String? // Para BANK
  walletProvider String? // Para WALLET (mercadopago, ualá, etc.)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relaciones
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  movements   FinancialMovement[] @relation("AccountMovements")
  transfersFrom FinancialMovement[] @relation("TransferFrom")
  transfersTo   FinancialMovement[] @relation("TransferTo")
  
  @@unique([businessId, name])
  @@index([businessId])
  @@index([type])
  @@map("financial_accounts")
}

// Movimiento financiero
model FinancialMovement {
  id          String   @id @default(cuid())
  businessId  String
  accountId   String   // Cuenta afectada
  
  type        FinancialMovementType
  amount      Decimal  @db.Decimal(12, 2) // Siempre positivo
  
  // Para transferencias entre cuentas
  transferFromAccountId String? // Cuenta origen (si es transferencia)
  transferToAccountId   String? // Cuenta destino (si es transferencia)
  
  // Referencia a la transacción que originó el movimiento
  sourceType  String?  // SALE, PURCHASE_PAYMENT, CASH_REGISTER_OPEN, SUPPLIER_PAYMENT, etc.
  sourceId    String?  // ID de la venta, compra, pago, etc.
  
  description String?
  notes       String?
  
  // Balance después del movimiento (snapshot para auditoría)
  balanceAfter Decimal @db.Decimal(12, 2)
  
  createdAt   DateTime @default(now())
  createdBy   String?  // userId
  
  // Relaciones
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  account     FinancialAccount @relation("AccountMovements", fields: [accountId], references: [id], onDelete: Restrict)
  transferFrom FinancialAccount? @relation("TransferFrom", fields: [transferFromAccountId], references: [id], onDelete: SetNull)
  transferTo   FinancialAccount? @relation("TransferTo", fields: [transferToAccountId], references: [id], onDelete: SetNull)
  
  @@index([businessId])
  @@index([accountId])
  @@index([sourceType, sourceId])
  @@index([createdAt])
  @@map("financial_movements")
}
```

### 2.3 Mapeo de Métodos de Pago a Cuentas

```typescript
// Configuración de mapeo
const PAYMENT_METHOD_TO_ACCOUNT_TYPE = {
  CASH_ARS: 'CASH',
  CASH_USD: 'CASH',
  TRANSFER: 'BANK',
  CARD: 'BANK', // o CREDIT_CARD según configuración
  QR: 'WALLET',
  ACCOUNT: null, // No afecta cuentas financieras (cuenta corriente cliente)
};
```

---

## 3. FLUJOS MODIFICADOS

### 3.1 Flujo de Ventas (Mejorado)

**ANTES:**
```
1. Crear venta
2. Registrar pagos en tabla Payment
3. Si método = CASH_ARS → afecta caja (solo en cierre)
4. Si método = TRANSFER/CARD/QR → NO afecta nada
```

**DESPUÉS:**
```
1. Crear venta
2. Para cada pago:
   a. Registrar en tabla Payment
   b. Determinar cuenta financiera según método:
      - CASH_ARS → Caja Efectivo
      - TRANSFER → Banco (cuenta configurada)
      - CARD → Banco o Tarjeta (según configuración)
      - QR → Billetera Virtual (MercadoPago, etc.)
   c. Crear FinancialMovement (INCOME)
   d. Actualizar balance de cuenta
3. Vincular venta con cashRegisterId (si aplica)
```

### 3.2 Flujo de Compras (Nuevo)

**ANTES:**
```
1. Crear compra
2. Si amountPaid > 0 → registrar pago como 'CASH' (hardcoded)
3. NO descuenta de ningún lado
```

**DESPUÉS:**
```
1. Crear compra
2. Si amountPaid > 0:
   a. Usuario selecciona método de pago (CASH, TRANSFER, CHECK)
   b. Determinar cuenta financiera según método
   c. Validar que cuenta tiene fondos suficientes
   d. Crear SupplierPayment con método específico
   e. Crear FinancialMovement (EXPENSE)
   f. Actualizar balance de cuenta
   g. Si es CASH → validar caja abierta y crear CashMovement
```

### 3.3 Flujo de Caja (Mejorado)

**ANTES:**
```
1. Abrir caja con monto inicial
2. NO se registra de dónde viene
3. Cerrar caja solo considera CASH_ARS
```

**DESPUÉS:**
```
ABRIR CAJA:
1. Usuario selecciona cuenta origen (BANK, WALLET, etc.)
2. Ingresa monto a transferir a caja
3. Validar fondos en cuenta origen
4. Crear transferencia:
   - FinancialMovement (EXPENSE) en cuenta origen
   - FinancialMovement (INCOME) en Caja Efectivo
5. Abrir CashRegisterSession con openingAmount
6. Crear CashMovement para auditoría

CERRAR CAJA:
1. Contar efectivo físico
2. Calcular monto esperado:
   = openingAmount
   + ventas en CASH_ARS
   + movimientos manuales INCOME
   - movimientos manuales EXPENSE
   - pagos a proveedores en CASH
3. Registrar diferencia
4. Usuario selecciona cuenta destino (BANK, WALLET)
5. Crear transferencia de Caja a cuenta destino
6. Cerrar CashRegisterSession
```

### 3.4 Flujo de Pagos a Proveedores (Nuevo)

**ANTES:**
```
1. Registrar pago con método 'CASH' (hardcoded)
2. NO descuenta de ningún lado
```

**DESPUÉS:**
```
1. Usuario selecciona método de pago (CASH, TRANSFER, CHECK)
2. Determinar cuenta financiera según método
3. Validar fondos disponibles
4. Crear SupplierPayment con método específico
5. Crear FinancialMovement (EXPENSE)
6. Actualizar balance de cuenta
7. Si es CASH → validar caja abierta y crear CashMovement
8. Actualizar saldo proveedor
```

---

## 4. REPORTES Y AUDITORÍA

### 4.1 Reporte de Cierre de Caja (Mejorado)

```
SESIÓN DE CAJA #123
Fecha: 16/02/2026
Usuario: Juan Pérez

┌─────────────────────────────────────────────┐
│ EFECTIVO (Caja Física)                      │
├─────────────────────────────────────────────┤
│ Monto Inicial:           $10,000.00         │
│ Ventas en Efectivo:      $25,000.00         │
│ Ingresos Manuales:        $1,000.00         │
│ Egresos Manuales:         $2,000.00         │
│ Pagos a Proveedores:      $5,000.00         │
├─────────────────────────────────────────────┤
│ Monto Esperado:          $29,000.00         │
│ Monto Contado:           $29,100.00         │
│ Diferencia:                 $100.00 ✓       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ OTROS MÉTODOS DE PAGO                       │
├─────────────────────────────────────────────┤
│ Transferencias:          $15,000.00         │
│   → Banco Nación                            │
│                                             │
│ Tarjetas:                 $8,000.00         │
│   → Banco Nación (débito/crédito)           │
│                                             │
│ QR (MercadoPago):         $3,000.00         │
│   → Billetera MercadoPago                   │
│                                             │
│ Cuenta Corriente:         $2,000.00         │
│   → No afecta cuentas financieras           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ RESUMEN TOTAL                               │
├─────────────────────────────────────────────┤
│ Total Ventas:            $53,000.00         │
│ Total Cobrado:           $53,000.00 ✓       │
└─────────────────────────────────────────────┘
```

### 4.2 Reporte de Movimientos Financieros

```
MOVIMIENTOS FINANCIEROS - 16/02/2026

┌──────────────────────────────────────────────────────────┐
│ CAJA EFECTIVO                                            │
├──────────────────────────────────────────────────────────┤
│ 08:00 | Transferencia desde Banco | +$10,000.00         │
│ 09:15 | Venta #001 (CASH_ARS)      | +$5,000.00          │
│ 10:30 | Venta #002 (CASH_ARS)      | +$3,000.00          │
│ 14:00 | Pago Proveedor #123        | -$5,000.00          │
│ 18:00 | Transferencia a Banco      | -$13,000.00         │
├──────────────────────────────────────────────────────────┤
│ Balance Final: $0.00                                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ BANCO NACIÓN                                             │
├──────────────────────────────────────────────────────────┤
│ 08:00 | Transferencia a Caja       | -$10,000.00         │
│ 09:30 | Venta #003 (TRANSFER)      | +$7,000.00          │
│ 11:00 | Venta #004 (CARD)          | +$4,000.00          │
│ 18:00 | Transferencia desde Caja   | +$13,000.00         │
├──────────────────────────────────────────────────────────┤
│ Balance Final: $14,000.00                                │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ MERCADOPAGO                                              │
├──────────────────────────────────────────────────────────┤
│ 10:00 | Venta #005 (QR)            | +$3,000.00          │
├──────────────────────────────────────────────────────────┤
│ Balance Final: $3,000.00                                 │
└──────────────────────────────────────────────────────────┘
```

---

## 5. VALIDACIONES Y REGLAS DE NEGOCIO

### 5.1 Validación de Fondos

```typescript
// Antes de registrar un pago/gasto
async function validateFunds(accountId: string, amount: number) {
  const account = await prisma.financialAccount.findUnique({
    where: { id: accountId }
  });
  
  if (!account) {
    throw new Error('Cuenta no encontrada');
  }
  
  if (account.balance < amount) {
    throw new Error(`Fondos insuficientes. Disponible: $${account.balance}, Requerido: $${amount}`);
  }
}
```

### 5.2 Validación de Caja Abierta

```typescript
// Para pagos en efectivo
async function validateCashRegisterOpen(userId: string) {
  const session = await prisma.cashRegisterSession.findFirst({
    where: {
      userId,
      status: 'OPEN'
    }
  });
  
  if (!session) {
    throw new Error('Debe abrir la caja antes de registrar pagos en efectivo');
  }
  
  return session;
}
```

### 5.3 Conciliación Automática

```typescript
// Al cerrar caja, validar que los movimientos coincidan
async function validateCashRegisterBalance(sessionId: string) {
  const movements = await prisma.financialMovement.findMany({
    where: {
      sourceType: 'SALE',
      createdAt: {
        gte: session.openedAt,
        lte: session.closedAt
      },
      account: {
        type: 'CASH'
      }
    }
  });
  
  const expectedBalance = calculateExpectedBalance(movements);
  const actualBalance = session.closingAmount;
  
  return {
    expected: expectedBalance,
    actual: actualBalance,
    difference: actualBalance - expectedBalance
  };
}
```

---

## 6. CONFIGURACIÓN INICIAL

### 6.1 Cuentas por Defecto (Seed)

```typescript
// Crear cuentas financieras por defecto al crear negocio
const defaultAccounts = [
  {
    type: 'CASH',
    name: 'Caja Principal',
    description: 'Caja física para efectivo',
    isDefault: true,
    balance: 0
  },
  {
    type: 'BANK',
    name: 'Cuenta Bancaria',
    description: 'Cuenta bancaria principal',
    isDefault: true,
    balance: 0
  }
];
```

### 6.2 Configuración de Métodos de Pago

```typescript
// En configuración del negocio
interface PaymentMethodConfig {
  method: string;
  accountId: string; // Cuenta financiera asociada
  isActive: boolean;
}

// Ejemplo:
const paymentConfig = [
  { method: 'CASH_ARS', accountId: 'caja-principal-id', isActive: true },
  { method: 'TRANSFER', accountId: 'banco-nacion-id', isActive: true },
  { method: 'QR', accountId: 'mercadopago-id', isActive: true }
];
```

---

## 7. BENEFICIOS DE LA SOLUCIÓN

### 7.1 Trazabilidad Completa
- ✅ Cada peso tiene origen y destino
- ✅ Auditoría completa de movimientos
- ✅ Conciliación con extractos bancarios

### 7.2 Control Financiero
- ✅ Validación de fondos disponibles
- ✅ Prevención de sobregiros
- ✅ Balance en tiempo real

### 7.3 Reportes Precisos
- ✅ Cierre de caja incluye todos los métodos
- ✅ Flujo de caja por cuenta
- ✅ Conciliación automática

### 7.4 Escalabilidad
- ✅ Soporte para múltiples cuentas bancarias
- ✅ Soporte para billeteras virtuales
- ✅ Fácil agregar nuevos métodos de pago

---

## 8. ORDEN DE IMPLEMENTACIÓN

1. ✅ **Fase 1: Modelos y Migraciones**
   - Crear modelos Prisma
   - Generar migrations
   - Crear seed de cuentas por defecto

2. **Fase 2: Servicios Backend**
   - FinancialAccountService
   - FinancialMovementService
   - Modificar SaleService
   - Modificar PurchaseService
   - Modificar PayableService
   - Modificar CashRegisterService

3. **Fase 3: API Endpoints**
   - CRUD de cuentas financieras
   - Listado de movimientos
   - Reportes

4. **Fase 4: Frontend**
   - UI gestión de cuentas
   - Selector de método de pago en compras
   - Selector de cuenta en abrir/cerrar caja
   - Reportes visuales

5. **Fase 5: Testing y Validación**
   - Tests unitarios
   - Tests de integración
   - Validación con datos reales

---

## 9. PRÓXIMOS PASOS

¿Estás de acuerdo con este enfoque? Si es así, comenzaré con:

1. Crear la migration de Prisma para los nuevos modelos
2. Implementar los servicios backend
3. Modificar los flujos existentes
4. Crear los endpoints API
5. Actualizar el frontend

