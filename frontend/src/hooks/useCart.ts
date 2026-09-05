"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Cart } from "@/types/cart";

export function useCart(enabled = true) {
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<{ cart: Cart }>("/cart").then((r) => r.cart),
    enabled,
    retry: false,
  });
}

export function useCartMutation() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cart"] });
  };
  const addItem = useMutation({
    mutationFn: (input: { productId: string; quantity?: number }) =>
      api.post<{ cart: Cart }>("/cart/items", input).then((r) => r.cart),
    onSuccess: (cart) => queryClient.setQueryData(["cart"], cart),
  });
  const updateItem = useMutation({
    mutationFn: (input: { id: string; quantity: number }) =>
      api.patch<{ cart: Cart }>(`/cart/items/${input.id}`, { quantity: input.quantity }).then((r) => r.cart),
    onSuccess: (cart) => queryClient.setQueryData(["cart"], cart),
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => api.del<{ cart: Cart }>(`/cart/items/${id}`).then((r) => r.cart),
    onSuccess: (cart) => queryClient.setQueryData(["cart"], cart),
  });
  const clear = useMutation({
    mutationFn: () => api.del<{ cart: Cart }>("/cart").then((r) => r.cart),
    onSuccess: (cart) => queryClient.setQueryData(["cart"], cart),
  });
  return { addItem, updateItem, removeItem, clear, invalidate };
}
