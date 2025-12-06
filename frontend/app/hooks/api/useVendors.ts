import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface Vendor {
  id: string;
  email: string;
  proposals?: any[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/vendor`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch vendors');
      }
      return data.data as Vendor[];
    },
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/vendor/${id}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch vendor');
      }
      return data.data as Vendor;
    },
    enabled: !!id,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(`${BACKEND_URL}/api/vendor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to create vendor');
      }
      return data.data as Vendor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const response = await fetch(`${BACKEND_URL}/api/vendor/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update vendor');
      }
      return data.data as Vendor;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendor', variables.id] });
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${BACKEND_URL}/api/vendor/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to delete vendor');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}
