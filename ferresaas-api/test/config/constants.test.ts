import { describe, expect, it } from '@jest/globals';
import {
  ACCOUNT_MOVEMENT_TYPES,
  AUDIT_ACTIONS,
  CASH_REGISTER_STATUS,
  CUSTOMER_TYPES,
  INVOICE_STATUS,
  INVOICE_TYPES,
  INVENTORY_MOVEMENT_TYPES,
  PAYMENT_METHODS,
  PERMISSIONS,
  PRODUCT_UNITS,
  SALE_STATUS,
  TAX_CONDITIONS,
  USER_ROLES,
} from '@/config/constants';

describe('config/constants', () => {
  it('exports expected domain constants', () => {
    expect(USER_ROLES.OWNER).toBe('OWNER');
    expect(PERMISSIONS.SALES_APPROVE_DISCOUNT).toBe('sales:approve_discount');
    expect(TAX_CONDITIONS.MONOTRIBUTO).toBe('MONOTRIBUTO');
    expect(INVOICE_TYPES.A).toBe('A');
    expect(PAYMENT_METHODS.CARD).toBe('CARD');
    expect(SALE_STATUS.CONFIRMED).toBe('CONFIRMED');
    expect(INVOICE_STATUS.INVOICED).toBe('INVOICED');
    expect(INVENTORY_MOVEMENT_TYPES.RETURN).toBe('RETURN');
    expect(CASH_REGISTER_STATUS.OPEN).toBe('OPEN');
    expect(CUSTOMER_TYPES.COMPANY).toBe('COMPANY');
    expect(ACCOUNT_MOVEMENT_TYPES.PAYMENT).toBe('PAYMENT');
    expect(AUDIT_ACTIONS.PASSWORD_RESET).toBe('PASSWORD_RESET');
    expect(PRODUCT_UNITS.KILOGRAM).toBe('kg');
  });
});
