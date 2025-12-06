import { useQuery } from '@tanstack/react-query';

interface ProposalItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specs?: Record<string, string>;
}

interface Proposal {
  id: string;
  budgetAmount: string;
  budgetCurrency: string;
  items: ProposalItem[];
  notes: string | null;
  extraItems: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  vendor: {
    id: string;
    email: string;
  };
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function useProposalsByRfp(rfpId: string) {
  return useQuery({
    queryKey: ['proposals', 'rfp', rfpId],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/proposal/rfp/${rfpId}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch proposals');
      }
      return data.data as Proposal[];
    },
    enabled: !!rfpId,
  });
}

export function useProposal(id: string) {
  return useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/proposal/${id}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch proposal');
      }
      return data.data as Proposal;
    },
    enabled: !!id,
  });
}
