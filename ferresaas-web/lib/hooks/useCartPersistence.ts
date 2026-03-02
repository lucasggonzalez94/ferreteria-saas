import { useEffect, useCallback } from 'react';
import type { Product } from '@/types';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountedPrice?: number;
  discountReason?: string;
  discountApprovedBy?: string;
}

const CART_STORAGE_KEY = 'pos_cart_session';

export function useCartPersistence() {
  const saveCart = useCallback((cart: CartItem[]) => {
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to sessionStorage:', error);
    }
  }, []);

  const loadCart = useCallback((): CartItem[] => {
    try {
      const stored = sessionStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading cart from sessionStorage:', error);
    }
    return [];
  }, []);

  const clearCart = useCallback(() => {
    try {
      sessionStorage.removeItem(CART_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing cart from sessionStorage:', error);
    }
  }, []);

  const addProductToCart = useCallback((product: Product) => {
    const currentCart = loadCart();
    const existing = currentCart.find((item) => item.product.id === product.id);

    let updatedCart: CartItem[];

    if (existing) {
      updatedCart = currentCart.map((item) =>
        item.product.id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              subtotal: (item.quantity + 1) * item.unitPrice,
            }
          : item
      );
    } else {
      updatedCart = [
        ...currentCart,
        {
          product,
          quantity: 1,
          unitPrice: product.price,
          subtotal: product.price,
        },
      ];
    }

    saveCart(updatedCart);
    return updatedCart;
  }, [loadCart, saveCart]);

  return {
    saveCart,
    loadCart,
    clearCart,
    addProductToCart,
  };
}
