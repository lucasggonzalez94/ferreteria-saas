import { purchaseStatusMap, getPurchaseStatusLabel, getPurchaseStatusColor } from '@/lib/purchase-status';

describe('purchase-status', () => {
  describe('purchaseStatusMap', () => {
    it('should have PENDING status', () => {
      expect(purchaseStatusMap.PENDING).toEqual({
        label: 'Pendiente',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      });
    });

    it('should have PARTIAL status', () => {
      expect(purchaseStatusMap.PARTIAL).toEqual({
        label: 'Parcialmente Pagada',
        color: 'bg-blue-100 text-blue-800 border-blue-300',
      });
    });

    it('should have PAID status', () => {
      expect(purchaseStatusMap.PAID).toEqual({
        label: 'Pagada',
        color: 'bg-green-100 text-green-800 border-green-300',
      });
    });

    it('should have CONFIRMED status', () => {
      expect(purchaseStatusMap.CONFIRMED).toEqual({
        label: 'Confirmada',
        color: 'bg-gray-100 text-gray-800 border-gray-300',
      });
    });

    it('should have CANCELLED status', () => {
      expect(purchaseStatusMap.CANCELLED).toEqual({
        label: 'Cancelada',
        color: 'bg-red-100 text-red-800 border-red-300',
      });
    });
  });

  describe('getPurchaseStatusLabel', () => {
    it('should return label for known status', () => {
      expect(getPurchaseStatusLabel('PENDING')).toBe('Pendiente');
    });

    it('should return status for unknown status', () => {
      expect(getPurchaseStatusLabel('UNKNOWN')).toBe('UNKNOWN');
    });

    it('should return status for undefined', () => {
      expect(getPurchaseStatusLabel(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe('getPurchaseStatusColor', () => {
    it('should return color for known status', () => {
      expect(getPurchaseStatusColor('PAID')).toBe('bg-green-100 text-green-800 border-green-300');
    });

    it('should return default color for unknown status', () => {
      expect(getPurchaseStatusColor('UNKNOWN')).toBe('bg-gray-100 text-gray-800 border-gray-300');
    });

    it('should return default color for undefined', () => {
      expect(getPurchaseStatusColor(undefined as unknown as string)).toBe('bg-gray-100 text-gray-800 border-gray-300');
    });
  });
});