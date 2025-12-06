import { useQuery, useMutation } from '@tanstack/react-query';

interface RFP {
  id: string;
  user_input: string;
  budgetAmount: string;
  budgetCurrency: string;
  proporsalFinalisingEndDate: number | null;
  extraItems: { [key: string]: string };
  createdAt: string;
  items?: any[];
  proposals?: any[];
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function useRfps() {
  return useQuery({
    queryKey: ['rfps'],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/rfp`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch RFPs');
      }
      return data.data as RFP[];
    },
  });
}

export function useRfp(id: string) {
  return useQuery({
    queryKey: ['rfp', id],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/rfp/${id}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch RFP');
      }
      return data.data as RFP;
    },
    enabled: !!id,
  });
}

export function useSendRfpToVendors() {
  return useMutation({
    mutationFn: async ({ rfpId, vendorIds }: { rfpId: string; vendorIds: string[] }) => {
      const response = await fetch(`${BACKEND_URL}/api/rfp/${rfpId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorIds }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to send RFP to vendors');
      }
      return data;
    },
  });
}

export function useRfpRecommendation(rfpId: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['rfp-recommendation', rfpId],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/rfp/${rfpId}/recommendation`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch recommendation');
      }
      return data.data;
    },
    enabled: enabled && !!rfpId,
  });
}
