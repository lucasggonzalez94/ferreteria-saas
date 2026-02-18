# Integración Caja - Cuentas Financieras

## Resumen

Este documento describe la integración implementada entre el módulo de Caja (Cash Register) y el módulo de Cuentas Financieras (Financial Accounts), que permite que todos los movimientos de caja se reflejen automáticamente en las cuentas financieras del negocio.

**IMPORTANTE:** La cuenta financiera de efectivo representa el dinero físico real. Al abrir caja, NO se suma el monto total, solo se registran las DIFERENCIAS detectadas.

## Flujo Implementado

### 1. Apertura de Caja

**Endpoint:** `GET /cash-register/suggested-opening`

Obtiene el monto sugerido para apertura (balance actual de la cuenta CASH):

**Respuesta:**
```json
{
  "suggestedAmount": 300000,
  "accountId": "account_id",
  "accountName": "Caja Principal"
}
```

**Endpoint:** `POST /cash-register/open`

**Flujo:**
1. Se verifica que no haya una caja abierta para el usuario
2. Se obtiene el balance actual de la cuenta financiera de tipo `CASH` (isDefault=true, isActive=true)
3. Se calcula la diferencia: `difference = openingAmount - currentBalance`
4. Se crea la sesión de caja con el `openingAmount`
5. **Solo si hay diferencia** (`|difference| > 0.01`), se crea un movimiento de ajuste:
   - **Tipo:** `INCOME` si difference > 0 (se agregó dinero), `EXPENSE` si difference < 0 (se retiró dinero)
   - **Monto:** `|difference|`
   - **sourceType:** `CASH_REGISTER_OPEN_ADJUSTMENT`
   - **sourceId:** ID de la sesión de caja
   - **Descripción:** "Ingreso detectado al abrir caja: $X" o "Retiro detectado al abrir caja: $X"
   - **Notas:** Balance anterior y monto de apertura

**Respuesta:**
```json
{
  "id": "session_id",
  "openingAmount": 320000,
  "currentAccountBalance": 300000,
  "differenceWithAccount": 20000,
  "hasDifference": true,
  ...
}
```

**Frontend:**
- El input se **prellena automáticamente** con el balance de la cuenta CASH
- Si el usuario modifica el monto, se muestra un **modal de confirmación** con:
  - Balance actual en cuenta
  - Monto a abrir
  - Diferencia calculada
  - Advertencia de que se registrará ingreso/retiro
- El usuario debe confirmar para proceder
- Si confirma, se abre la caja y se registra el ajuste

### 2. Movimientos de Caja

**Endpoint:** `POST /cash-register/move`

**Flujo:**
1. Se verifica que haya una caja abierta
2. Se crea el registro de `cashMovement` (INCOME o EXPENSE)
3. Se busca la cuenta financiera de tipo `CASH` por defecto
4. Se crea un movimiento financiero que refleja el movimiento de caja:
   - **Tipo:** Mismo que el movimiento de caja (INCOME/EXPENSE)
   - **Monto:** Mismo monto
   - **sourceType:** `CASH_REGISTER_MOVEMENT`
   - **sourceId:** ID del movimiento de caja
   - **Descripción:** Razón del movimiento

**Ejemplo:**
- Ingreso manual de $50,000 por "Venta de chatarra"
  - Se registra en `cash_movements`
  - Se crea movimiento financiero INCOME de $50,000 en "Caja Principal"
  - El balance de Finanzas aumenta en $50,000

### 3. Cierre de Caja

**Endpoint:** `POST /cash-register/close`

**Flujo:**
1. Se obtiene la sesión abierta con sus ventas y movimientos
2. Se calcula el `expectedAmount`:
   - `expectedAmount = openingAmount + ventas_efectivo + movimientos_INCOME - movimientos_EXPENSE`
3. Se calcula la diferencia:
   - `difference = closingAmount - expectedAmount`
4. Se cierra la sesión actualizando el estado
5. Si hay diferencia (`|difference| > 0.01`), se crea un movimiento de ajuste:
   - **Tipo:** `INCOME` si `difference > 0` (sobrante), `EXPENSE` si `difference < 0` (faltante)
   - **Monto:** `|difference|`
   - **sourceType:** `CASH_REGISTER_DIFFERENCE`
   - **sourceId:** ID de la sesión de caja
   - **Descripción:** "Sobrante en cierre de caja: $X" o "Faltante en cierre de caja: $X"

**Ejemplo:**
- Monto esperado: $300,000
- Monto de cierre (arqueo): $299,500
- Diferencia: -$500 (faltante)
- Se crea movimiento financiero EXPENSE de $500 en "Caja Principal"
- El balance de Finanzas refleja el faltante

## Cuenta Financiera Utilizada

**Criterios de selección:**
- `type = 'CASH'`
- `isDefault = true`
- `isActive = true`

**Configuración recomendada:**
En el seed se crea una cuenta "Caja Principal" que cumple estos criterios. Si no existe una cuenta que cumpla los criterios, los movimientos de caja NO se reflejarán en Finanzas (pero la caja seguirá funcionando normalmente).

## Tipos de Movimientos Financieros

Los movimientos creados por el módulo de caja tienen los siguientes `sourceType`:

| sourceType | Descripción | Cuándo se crea |
|------------|-------------|----------------|
| `CASH_REGISTER_OPEN_ADJUSTMENT` | Ajuste al abrir caja | Al abrir caja con monto diferente al balance de cuenta |
| `CASH_REGISTER_MOVEMENT` | Movimiento manual de caja | Al registrar ingreso/egreso manual |
| `CASH_REGISTER_DIFFERENCE` | Ajuste por diferencia en cierre | Al cerrar caja con diferencia entre esperado y real |

## Detección de Diferencias

### Al Abrir Caja

El sistema compara el `openingAmount` con el `currentBalance` de la cuenta financiera:

```typescript
differenceWithAccount = openingAmount - currentBalance
```

**Casos:**
- `differenceWithAccount > 0`: Se agregó dinero a la caja (ingreso de efectivo)
- `differenceWithAccount < 0`: Se retiró dinero de la caja (retiro de efectivo)
- `differenceWithAccount = 0`: Coincide perfectamente con el balance

**Frontend:**
- Si `|differenceWithAccount| > 0.01`, se muestra un **modal de confirmación** antes de abrir
- El modal muestra:
  - Balance actual en cuenta
  - Monto a abrir
  - Diferencia calculada
  - Tipo de movimiento que se registrará (INGRESO o RETIRO)
- El usuario debe confirmar explícitamente para proceder
- Si cancela, el input se restaura al balance sugerido

### Al Cerrar Caja

El sistema compara el `closingAmount` (arqueo físico) con el `expectedAmount` (calculado):

```typescript
difference = closingAmount - expectedAmount
```

**Casos:**
- `difference > 0`: Sobrante (más dinero del esperado)
- `difference < 0`: Faltante (menos dinero del esperado)
- `difference = 0`: Cuadra perfectamente

Si hay diferencia, se registra automáticamente como movimiento financiero de ajuste.

## Impacto en Balances

### Ejemplo Completo

**Estado inicial:**
- Cuenta "Caja Principal" en Finanzas: $200,000

**Día 1:**

**1. Apertura de caja:**
- Input prellenado con: $200,000
- Usuario confirma: $200,000
- Sin diferencia → Sin movimiento financiero
- Balance en Finanzas: $200,000 (sin cambios)

**2. Venta en efectivo de $100,000:**
- (Las ventas se registran automáticamente en otro flujo)
- Balance esperado en caja física: $300,000

**3. Cierre de caja:**
- Monto esperado: $300,000
- Arqueo físico: $300,000
- Sin diferencia → Sin movimiento de ajuste
- Balance en Finanzas: $300,000

**Día 2:**

**4. Apertura de caja:**
- Input prellenado con: $300,000
- Usuario ingresa: $320,000 (agregó $20,000 de su bolsillo)
- **Modal de confirmación:**
  - Balance en cuenta: $300,000
  - Monto a abrir: $320,000
  - Diferencia: +$20,000
  - Advertencia: "Se registrará un INGRESO de efectivo"
- Usuario confirma
- Movimiento financiero: INCOME $20,000
- Balance en Finanzas: $320,000

**5. Movimiento manual - Egreso de $10,000 por "Pago a proveedor":**
- Movimiento financiero: EXPENSE $10,000
- Balance en Finanzas: $310,000

**6. Cierre de caja:**
- Monto esperado: $310,000
- Arqueo físico: $309,800
- Diferencia: -$200 (faltante)
- Movimiento financiero: EXPENSE $200 (ajuste)
- Balance final en Finanzas: $309,800

**Día 3:**

**7. Apertura de caja:**
- Input prellenado con: $309,800
- Usuario ingresa: $300,000 (retiró $9,800 para depositar en banco)
- **Modal de confirmación:**
  - Balance en cuenta: $309,800
  - Monto a abrir: $300,000
  - Diferencia: -$9,800
  - Advertencia: "Se registrará un RETIRO de efectivo"
- Usuario confirma
- Movimiento financiero: EXPENSE $9,800
- Balance en Finanzas: $300,000

## Permisos

Los movimientos financieros se crean automáticamente por el sistema, sin validar permisos de `financial_accounts:*` en el usuario que opera la caja. Esto es intencional para que:

1. Los cajeros puedan abrir/cerrar caja sin necesitar permisos de finanzas
2. Los movimientos financieros se registren de forma consistente
3. La auditoría sea completa

Los permisos requeridos son:
- `cash_register:open` - Para abrir caja
- `cash_register:manage` - Para movimientos manuales
- `cash_register:close` - Para cerrar caja

## Auditoría

Todos los movimientos financieros creados por el módulo de caja incluyen:
- `sourceType`: Identifica el origen del movimiento
- `sourceId`: ID de la sesión o movimiento de caja relacionado
- `createdBy`: Usuario que realizó la acción en caja

Esto permite rastrear completamente el origen de cada movimiento financiero.

## Consideraciones

### Múltiples Cuentas de Caja

Si el negocio tiene múltiples cuentas de tipo `CASH`, solo la marcada como `isDefault = true` se usará para los movimientos automáticos de caja.

### Caja sin Cuenta Financiera

Si no existe una cuenta `CASH` por defecto activa:
- La caja seguirá funcionando normalmente
- Los movimientos NO se reflejarán en Finanzas
- Se recomienda crear una cuenta "Caja Principal" con `type=CASH`, `isDefault=true`, `isActive=true`

### Ventas en Efectivo

Las ventas en efectivo se registran en otro flujo (no documentado aquí). El cierre de caja las considera en el `expectedAmount` pero no crea movimientos financieros adicionales por ellas.

### Transferencias a Banco

Si al cerrar caja se desea transferir el efectivo a una cuenta bancaria, esto debe hacerse manualmente usando la función "Transferir entre Cuentas" en el módulo de Finanzas.

## Archivos Modificados

### Backend
- `ferresaas-api/src/routes/cash-register.routes.ts`
  - Agregada integración con `FinancialMovementService`
  - Movimientos financieros en apertura, movimientos manuales y cierre
  - Detección de diferencias con cierre anterior

### Frontend
- `ferresaas-web/app/dashboard/cash-register/page.tsx`
  - Toast de advertencia al detectar diferencia con cierre anterior
  - Invalidación de queries de cuentas financieras

## Testing

Para probar la integración:

1. **Verificar cuenta de caja:**
   ```sql
   SELECT * FROM financial_accounts 
   WHERE type = 'CASH' AND "isDefault" = true AND "isActive" = true;
   ```
   Resultado esperado: Balance inicial (ej: $200,000)

2. **Abrir caja con balance exacto:**
   - Input debe estar prellenado con $200,000
   - Confirmar sin modificar
   - NO debe aparecer movimiento financiero nuevo
   - Balance de "Caja Principal" debe seguir en $200,000

3. **Registrar movimiento manual (ingreso $50,000):**
   - Verificar que aparece movimiento en Finanzas
   - Balance debe aumentar a $250,000

4. **Cerrar caja con diferencia:**
   - Monto esperado: $250,000
   - Arqueo: $249,800 (faltante de $200)
   - Verificar que aparece movimiento de ajuste "Faltante en cierre de caja: $200.00"
   - Balance final debe ser $249,800

5. **Abrir nueva caja con diferencia:**
   - Input prellenado con $249,800
   - Usuario ingresa $250,000 (agregó $200 de su bolsillo)
   - Debe mostrar modal de confirmación:
     - Balance en cuenta: $249,800
     - Monto a abrir: $250,000
     - Diferencia: +$200
     - Advertencia: "Se registrará un INGRESO de efectivo"
   - Al confirmar, debe aparecer movimiento "Ingreso detectado al abrir caja: $200.00"
   - Balance debe ser $250,000

6. **Verificar que no se duplican montos:**
   - El balance de la cuenta debe reflejar el efectivo real
   - No debe haber suma acumulativa incorrecta
   - Cada apertura sin diferencia NO debe crear movimiento

## Próximas Mejoras

- [ ] Permitir seleccionar cuenta de caja al abrir (en lugar de usar solo la default)
- [ ] Opción de transferir automáticamente a banco al cerrar
- [ ] Dashboard de diferencias históricas
- [ ] Alertas automáticas por diferencias mayores a un umbral
- [ ] Reportes de movimientos de caja vs. movimientos financieros
