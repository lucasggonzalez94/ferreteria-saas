import { renderHook, act } from '@testing-library/react';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';

describe('useConfirmDialog', () => {
  it('should return initial state with isOpen false', () => {
    const { result } = renderHook(() => useConfirmDialog());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('should open dialog with data', () => {
    const { result } = renderHook(() => useConfirmDialog<{ id: string; name: string }>());

    act(() => {
      result.current.open({ id: '123', name: 'Test Item' });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual({ id: '123', name: 'Test Item' });
  });

  it('should close dialog', () => {
    const { result } = renderHook(() => useConfirmDialog<{ id: string }>());

    act(() => {
      result.current.open({ id: '123' });
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toEqual({ id: '123' });
  });

  it('should reset dialog', () => {
    const { result } = renderHook(() => useConfirmDialog<{ id: string }>());

    act(() => {
      result.current.open({ id: '123' });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('should handle open with different data types', () => {
    const { result } = renderHook(() => useConfirmDialog<string>());

    act(() => {
      result.current.open('confirm-message');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBe('confirm-message');
  });
});