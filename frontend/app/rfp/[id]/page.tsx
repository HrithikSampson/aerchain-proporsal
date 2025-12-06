'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { useRfp, useSendRfpToVendors, useRfpRecommendation } from '../../hooks/api/useRfps';
import { useProposalsByRfp } from '../../hooks/api/useProposals';
import { useVendors } from '../../hooks/api/useVendors';

interface RfpItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  category: string;
}

export default function RfpDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rfpId = params.id as string;

  const { data: rfp, isLoading, error } = useRfp(rfpId);
  const { data: proposals = [], isLoading: isLoadingProposals } = useProposalsByRfp(rfpId);
  const { data: vendors = [], isLoading: isLoadingVendors } = useVendors();
  const sendRfpMutation = useSendRfpToVendors();

  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);

  const { data: recommendationData, isLoading: isLoadingRecommendation } = useRfpRecommendation(
    rfpId,
    showRecommendation && proposals.length > 0
  );

  const handleSendRfp = async () => {
    if (selectedVendorIds.length === 0) {
      alert('Please select at least one vendor');
      return;
    }

    try {
      await sendRfpMutation.mutateAsync({ rfpId, vendorIds: selectedVendorIds });
      alert(`RFP sent successfully to ${selectedVendorIds.length} vendor(s)`);
      setShowVendorModal(false);
      setSelectedVendorIds([]);
    } catch (error) {
      alert('Failed to send RFP: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendorIds(prev =>
      prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50 mx-auto"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading RFP details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            {error instanceof Error ? error.message : 'Failed to load RFP'}
          </h2>
          <button
            onClick={() => router.push('/')}
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  if (!rfp) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              RFP Details
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowVendorModal(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Send to Vendors
              </button>
              <button
                onClick={() => router.push('/')}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                  Request for Proposal
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 font-mono">
                  ID: {rfp.id}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Created: {new Date(rfp.createdAt).toLocaleDateString()} at{' '}
                  {new Date(rfp.createdAt).toLocaleTimeString()}
                </div>
                {rfp.proporsalFinalisingEndDate && (
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Deadline:{' '}
                    {new Date(rfp.proporsalFinalisingEndDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Description
                </h3>
                <p className="text-zinc-900 dark:text-zinc-50">{rfp.user_input}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Budget
                  </h3>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {rfp.budgetCurrency} {parseFloat(rfp.budgetAmount)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Status
                  </h3>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {rfp.proposals && rfp.proposals.length > 0 ? 'Proposals Received' : 'Open'}
                  </p>
                </div>
              </div>

              {rfp.extraItems && Object.keys(rfp.extraItems).length > 0 && (
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Additional Information
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(rfp.extraItems).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">{key}:</span>{' '}
                        <span className="text-zinc-900 dark:text-zinc-50">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {rfp.items && rfp.items.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Items ({rfp.items.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="pb-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Item Name
                      </th>
                      <th className="pb-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Category
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Quantity
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Unit Price
                      </th>
                      <th className="pb-3 text-right text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Total Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfp.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-zinc-200 dark:border-zinc-800 last:border-0"
                      >
                        <td className="py-3 text-sm text-zinc-900 dark:text-zinc-50">
                          {item.itemName}
                        </td>
                        <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {item.category}
                        </td>
                        <td className="py-3 text-right text-sm text-zinc-900 dark:text-zinc-50">
                          {item.quantity}
                        </td>
                        <td className="py-3 text-right text-sm text-zinc-900 dark:text-zinc-50">
                          {rfp.budgetCurrency} {parseFloat(item.unitPrice)}
                        </td>
                        <td className="py-3 text-right text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {rfp.budgetCurrency} {parseFloat(item.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {proposals.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  AI Vendor Recommendation
                </h2>
                <button
                  onClick={() => setShowRecommendation(!showRecommendation)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {showRecommendation ? 'Hide' : 'Get AI Recommendation'}
                </button>
              </div>

              {showRecommendation && (
                <>
                  {isLoadingRecommendation ? (
                    <div className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                      Analyzing proposals with AI...
                    </div>
                  ) : recommendationData ? (
                    <div className="space-y-6">
                      <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">✓</div>
                          <div>
                            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                              Recommended Vendor: {recommendationData.recommendation.recommendedVendor}
                            </h3>
                            <p className="text-sm text-green-800 dark:text-green-200">
                              {recommendationData.recommendation.reasoning}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                          Quick Stats
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Lowest Price</div>
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                              {recommendationData.comparison.lowestPrice}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Highest Price</div>
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                              {recommendationData.comparison.highestPrice}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Average Price</div>
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                              {rfp.budgetCurrency} {recommendationData.comparison.averagePrice}
                            </div>
                          </div>
                          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Price Range</div>
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                              {rfp.budgetCurrency} {recommendationData.comparison.priceRange}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                          Insights
                        </h3>
                        <ul className="space-y-1">
                          {recommendationData.comparison.insights.map((insight: string, idx: number) => (
                            <li key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                              <span className="text-blue-600 dark:text-blue-400">•</span>
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                          Detailed Vendor Scores
                        </h3>
                        <div className="space-y-3">
                          {recommendationData.recommendation.comparison.map((vendor: any, idx: number) => (
                            <div
                              key={idx}
                              className={`rounded-lg border p-4 ${
                                vendor.vendorEmail === recommendationData.recommendation.recommendedVendor
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-zinc-200 dark:border-zinc-800'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                                    {vendor.vendorEmail}
                                  </div>
                                  {vendor.vendorEmail === recommendationData.recommendation.recommendedVendor && (
                                    <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                      RECOMMENDED
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                                    {vendor.score}
                                  </div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Overall Score
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3 mb-3">
                                <div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Price</div>
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                                    {vendor.priceScore}/100
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Completeness</div>
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                                    {vendor.completenessScore}/100
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Terms</div>
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                                    {vendor.termsScore}/100
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                                    Strengths
                                  </div>
                                  <ul className="space-y-1">
                                    {vendor.strengths.map((strength: string, sIdx: number) => (
                                      <li key={sIdx} className="text-xs text-zinc-600 dark:text-zinc-400">
                                        + {strength}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <div className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-1">
                                    Weaknesses
                                  </div>
                                  <ul className="space-y-1">
                                    {vendor.weaknesses.map((weakness: string, wIdx: number) => (
                                      <li key={wIdx} className="text-xs text-zinc-600 dark:text-zinc-400">
                                        - {weakness}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          Summary
                        </h3>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          {recommendationData.recommendation.summary}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Vendor Proposals {!isLoadingProposals && `(${proposals.length})`}
            </h2>

            {isLoadingProposals ? (
              <div className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                Loading proposals...
              </div>
            ) : proposals.length === 0 ? (
              <div className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                No vendor proposals yet
              </div>
            ) : (
              <div className="space-y-4">
                {proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {proposal.vendor.email}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                          Submitted: {new Date(proposal.createdAt).toLocaleDateString()} at{' '}
                          {new Date(proposal.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                          {proposal.budgetCurrency} {parseFloat(proposal.budgetAmount).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {proposal.items && proposal.items.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Items ({proposal.items.length})
                        </h4>
                        <div className="space-y-2">
                          {proposal.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-sm bg-zinc-50 dark:bg-zinc-900 rounded p-2"
                            >
                              <div className="flex-1">
                                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                                  {item.name}
                                </span>
                                <span className="text-zinc-600 dark:text-zinc-400 ml-2">
                                  × {item.quantity}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-zinc-900 dark:text-zinc-50">
                                  {proposal.budgetCurrency} {item.unitPrice} each
                                </div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                  Total: {proposal.budgetCurrency} {item.totalPrice}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {proposal.notes && (
                      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                          Notes
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {proposal.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Send RFP to Vendors
              </h2>
              <button
                onClick={() => {
                  setShowVendorModal(false);
                  setSelectedVendorIds([]);
                }}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Select vendors to send this RFP to:
              </p>

              {isLoadingVendors ? (
                <p className="text-sm text-zinc-500">Loading vendors...</p>
              ) : vendors.length === 0 ? (
                <p className="text-sm text-zinc-500">No vendors available. Please create vendors first.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {vendors.map((vendor) => (
                    <label
                      key={vendor.id}
                      className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 cursor-pointer hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <input
                        type="checkbox"
                        checked={selectedVendorIds.includes(vendor.id)}
                        onChange={() => toggleVendorSelection(vendor.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-zinc-900 dark:text-zinc-50">
                        {vendor.email}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowVendorModal(false);
                  setSelectedVendorIds([]);
                }}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSendRfp}
                disabled={selectedVendorIds.length === 0 || sendRfpMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-zinc-700"
              >
                {sendRfpMutation.isPending ? 'Sending...' : `Send to ${selectedVendorIds.length} vendor(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
