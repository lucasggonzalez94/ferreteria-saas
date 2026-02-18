# Guía de Inputs Numéricos - Normalización de Separadores Decimales

## Problema Resuelto

La aplicación ahora soporta múltiples formatos de entrada numérica, permitiendo que usuarios de diferentes locales escriban números de manera natural:

- **Formato europeo/argentino**: `100.000,50` (100 mil con 50 centavos)
- **Formato estadounidense**: `100,000.50`
- **Sin separadores**: `100000.50`
- **Variante**: `100000,50`

Todos estos formatos se normalizan automáticamente al mismo valor numérico.

## Archivos Creados

### 1. `lib/numeric-input.ts`
Utility con funciones para normalizar y parsear números:

```typescript
import { parseNumericInput, formatNumericDisplay, isValidNumericInput } from '@/lib/numeric-input';

// Parsear entrada del usuario
const value = parseNumericInput("100.000,50"); // Retorna: 100000.5

// Formatear para mostrar
const display = formatNumericDisplay(100000.5); // Retorna: "100.000,50"

// Validar entrada
const isValid = isValidNumericInput("100.000,50"); // Retorna: true
```

**Funciones disponibles:**
- `parseNumericInput(value)` - Convierte string a número, soportando múltiples formatos
- `formatNumericDisplay(value, decimals, locale)` - Formatea número para mostrar
- `isValidNumericInput(value)` - Valida si un string es un número válido
- `getDecimalPlaces(value)` - Obtiene cantidad de decimales

### 2. `lib/hooks/useNumericInput.ts`
Hook personalizado para manejar inputs numéricos con validación:

```typescript
import { useNumericInput } from '@/lib/hooks/useNumericInput';

export function MyComponent() {
  const quantity = useNumericInput({
    initialValue: 10,
    decimals: 2,
    min: 0,
    max: 1000,
    allowNegative: false,
    onValidChange: (value) => console.log('Valor válido:', value)
  });

  return (
    <div>
      <input
        type="number"
        value={quantity.displayValue}
        onChange={quantity.handleChange}
        onBlur={quantity.handleBlur}
      />
      <p>Valor parseado: {quantity.parsedValue}</p>
      <p>Es válido: {quantity.isValid}</p>
    </div>
  );
}
```

**Opciones del hook:**
- `initialValue` - Valor inicial (número o string)
- `decimals` - Cantidad de decimales a redondear (default: 2)
- `min` - Valor mínimo permitido
- `max` - Valor máximo permitido
- `allowNegative` - Permitir números negativos (default: false)
- `onValidChange` - Callback cuando el valor es válido

**Propiedades retornadas:**
- `displayValue` - Valor mostrado en el input
- `parsedValue` - Valor numérico parseado
- `handleChange` - Handler para onChange
- `handleBlur` - Handler para onBlur (normaliza y valida)
- `setValue` - Función para establecer valor programáticamente
- `reset` - Función para resetear al valor inicial
- `isValid` - Boolean indicando si el valor es válido

## Archivos Modificados

Se actualizaron los siguientes archivos para usar `parseNumericInput`:

### Páginas
- `app/dashboard/pos/page.tsx` - Cantidad, montos de pago, descuentos, vuelto
- `app/dashboard/purchases/new/page.tsx` - Cantidad, costo unitario, IVA
- `app/dashboard/products/[id]/page.tsx` - Costo, precio, IVA, stock mínimo
- `app/dashboard/payables/page.tsx` - Monto de pagos

### Componentes
- `components/quick-create-product-modal.tsx` - Costo, precio, IVA, margen
- `components/financial-accounts/transfer-modal.tsx` - Monto de transferencia
- `components/financial-accounts/movement-modal.tsx` - Monto de movimiento
- `components/financial-accounts/create-account-modal.tsx` - Balance inicial
- `components/inventory/adjustment-modal.tsx` - Cantidad de ajuste
- `components/inventory/return-modal.tsx` - Cantidad de devolución

## Cómo Usar

### Opción 1: Usar `parseNumericInput` directamente

Para casos simples donde solo necesitas parsear un valor:

```typescript
import { parseNumericInput } from '@/lib/numeric-input';

const handleAddPayment = () => {
  const amount = parseNumericInput(paymentAmount); // Normaliza automáticamente
  if (!amount || amount <= 0) {
    toast.error("Ingresa un monto válido");
    return;
  }
  // Usar amount...
};
```

### Opción 2: Usar el hook `useNumericInput`

Para inputs con validación más compleja:

```typescript
import { useNumericInput } from '@/lib/hooks/useNumericInput';

export function ProductForm() {
  const price = useNumericInput({
    initialValue: 0,
    decimals: 2,
    min: 0,
    onValidChange: (value) => {
      // Actualizar estado o hacer algo con el valor
    }
  });

  return (
    <div>
      <Input
        type="number"
        step="0.01"
        value={price.displayValue}
        onChange={price.handleChange}
        onBlur={price.handleBlur}
      />
    </div>
  );
}
```

## Algoritmo de Detección de Formato

El `parseNumericInput` detecta automáticamente el formato:

1. **Si hay puntos Y comas**: El último separador es el decimal
   - `100.000,50` → 100000.50
   - `100,000.50` → 100000.50

2. **Si hay múltiples puntos**: Son separadores de miles
   - `100.000.50` → 100000.50

3. **Si hay múltiples comas**: Son separadores de miles
   - `100,000,50` → 100000.50

4. **Si hay una coma sin puntos**: Depende de posición
   - `100,50` → 100.50 (decimal)
   - `100,000` → 100000 (miles)

5. **Si hay un punto sin comas**: Es decimal
   - `100.50` → 100.50

## Casos de Uso Reales

### POS - Cantidad de Productos
```typescript
const newQty = parseNumericInput(e.target.value);
if (isNaN(newQty) || newQty <= 0) {
  removeFromCart(item.product.id);
} else if (newQty > item.product.stockQuantity) {
  toast.error(`Solo hay ${item.product.stockQuantity} disponibles`);
} else {
  updateQuantity(item.product.id, newQty);
}
```

### Compras - Costo Unitario
```typescript
const newItem: PurchaseItem = {
  productId: selectedProductId,
  quantity: parseNumericInput(quantity),
  unitCost: parseNumericInput(unitCost),
  taxRate: parseNumericInput(taxRate),
};
```

### Cuentas Financieras - Transferencia
```typescript
const amountNum = parseNumericInput(amount);
if (!amountNum || amountNum <= 0) {
  toast.error("Ingresa un monto válido");
  return;
}
if (fromAccount && amountNum > fromAccount.balance) {
  toast.error("Fondos insuficientes");
  return;
}
```

## Ventajas

✅ **Agnóstico de locale**: Funciona con cualquier formato de separadores
✅ **Transparente**: El usuario escribe naturalmente, la app normaliza automáticamente
✅ **Robusto**: Maneja casos ambiguos inteligentemente
✅ **Consistente**: Todos los inputs numéricos usan el mismo sistema
✅ **Validado**: Incluye funciones de validación y formateo
✅ **Type-safe**: Totalmente tipado con TypeScript

## Testing

Para probar la normalización:

```typescript
import { parseNumericInput } from '@/lib/numeric-input';

// Casos de prueba
console.log(parseNumericInput("100.000,50"));  // 100000.5
console.log(parseNumericInput("100,000.50"));  // 100000.5
console.log(parseNumericInput("100000.50"));   // 100000.5
console.log(parseNumericInput("100000,50"));   // 100000.5
console.log(parseNumericInput("100.50"));      // 100.5
console.log(parseNumericInput("100,50"));      // 100.5
console.log(parseNumericInput("100"));         // 100
console.log(parseNumericInput(""));            // 0
console.log(parseNumericInput("abc"));         // 0
```

## Notas Importantes

1. **El input sigue siendo `type="number"`** en la mayoría de casos para aprovechar validación nativa del navegador
2. **El parsing ocurre en `onBlur` o en el handler de submit**, no en cada keystroke
3. **Los valores se redondean** a la cantidad de decimales especificada
4. **Los valores fuera de rango** se ajustan automáticamente (min/max)
5. **Los números negativos** se pueden permitir con `allowNegative: true`

## Próximos Pasos

Si necesitas aplicar esto a más inputs:

1. Importa `parseNumericInput` en el archivo
2. Reemplaza `parseFloat()` con `parseNumericInput()`
3. Opcionalmente, usa el hook `useNumericInput` para validación más compleja
4. Prueba con diferentes formatos de entrada

## Soporte

Para preguntas o problemas con la normalización de números, revisa:
- `lib/numeric-input.ts` - Lógica de parsing
- `lib/hooks/useNumericInput.ts` - Hook personalizado
- Los archivos modificados para ver ejemplos de uso
