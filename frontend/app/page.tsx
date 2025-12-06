'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProposalSocket } from './hooks/useProposalSocket';
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor } from './hooks/api/useVendors';
import { useRfps } from './hooks/api/useRfps';

type TabType = 'vendors' | 'rfps';

interface Vendor {
  id: string;
  email: string;
  proposals?: any[];
}

export default function Home() {
  const router = useRouter();
  const { connected, rooms, fetchRooms } = useProposalSocket();

  const { data: vendors = [], isLoading: isLoadingVendors, refetch: refetchVendors } = useVendors();
  const { data: rfps = [], isLoading: isLoadingRfps, refetch: refetchRfps } = useRfps();
  const createVendorMutation = useCreateVendor();
  const updateVendorMutation = useUpdateVendor();
  const deleteVendorMutation = useDeleteVendor();

  const [activeTab, setActiveTab] = useState<TabType>('vendors');
  const [initialMessage, setInitialMessage] = useState('');
  const [showRooms, setShowRooms] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorEmail, setVendorEmail] = useState('');

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialMessage.trim() && !isStarting) {
      setIsStarting(true);
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
        const response = await fetch(`${backendUrl}/proposal/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();
        const { roomId } = data;

        sessionStorage.setItem(`room-${roomId}-initial`, initialMessage.trim());

        router.push(`/room/${roomId}`);
      } catch (error) {
        console.error('Failed to start session:', error);
        setIsStarting(false);
      }
    }
  };

  const handleFetchRooms = () => {
    fetchRooms();
    setShowRooms(true);
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  const handleViewRfp = (rfpId: string) => {
    router.push(`/rfp/${rfpId}`);
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorEmail.trim()) return;

    try {
      await createVendorMutation.mutateAsync(vendorEmail.trim());
      setVendorEmail('');
      setShowVendorForm(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create vendor');
    }
  };

  const handleUpdateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor || !vendorEmail.trim()) return;

    try {
      await updateVendorMutation.mutateAsync({
        id: editingVendor.id,
        email: vendorEmail.trim(),
      });
      setVendorEmail('');
      setEditingVendor(null);
      setShowVendorForm(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update vendor');
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;

    try {
      await deleteVendorMutation.mutateAsync(vendorId);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete vendor');
    }
  };

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorEmail(vendor.email);
    setShowVendorForm(true);
  };

  const handleCancelVendorForm = () => {
    setShowVendorForm(false);
    setEditingVendor(null);
    setVendorEmail('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              RFP Proposal System
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={handleFetchRooms}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                View Active Rooms
              </button>
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    connected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'vendors'
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            }`}
          >
            Vendors
          </button>
          <button
            onClick={() => setActiveTab('rfps')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rfps'
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            }`}
          >
            RFPs
          </button>
        </div>

        {showRooms && rooms.length > 0 && (
          <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Active Rooms ({rooms.length})
              </h2>
              <button
                onClick={() => setShowRooms(false)}
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Hide
              </button>
            </div>
            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.rfpId}
                  className="flex items-center justify-between rounded border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div>
                    <div className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {room.rfpId}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      {room.participantCount} participant(s)
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinRoom(room.rfpId)}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Vendors {!isLoadingVendors && `(${vendors.length})`}
                </h2>
                <button
                  onClick={() => setShowVendorForm(true)}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Add Vendor
                </button>
              </div>

              {isLoadingVendors ? (
                <div className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                  Loading vendors...
                </div>
              ) : vendors.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 dark:text-zinc-400">
                  No vendors found. Add your first vendor!
                </div>
              ) : (
                <div className="space-y-2">
                  {vendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      className="flex items-center justify-between rounded border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {vendor.email}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                          ID: {vendor.id} • Proposals: {vendor.proposals?.length || 0}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditVendor(vendor)}
                          className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteVendor(vendor.id)}
                          className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-200 dark:bg-red-900 dark:text-red-50 dark:hover:bg-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showVendorForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                  <h3 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                    {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
                  </h3>
                  <form onSubmit={editingVendor ? handleUpdateVendor : handleCreateVendor}>
                    <div className="mb-4">
                      <label
                        htmlFor="vendor-email"
                        className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Email Address
                      </label>
                      <input
                        id="vendor-email"
                        type="email"
                        value={vendorEmail}
                        onChange={(e) => setVendorEmail(e.target.value)}
                        placeholder="vendor@example.com"
                        className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        {editingVendor ? 'Update' : 'Create'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelVendorForm}
                        className="flex-1 rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rfps' && (
          <div className="space-y-6">
            {rfps.length > 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    All RFPs ({rfps.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {rfps.map((rfp) => (
                    <div
                      key={rfp.id}
                      className="flex items-start justify-between rounded border border-zinc-200 p-3 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 cursor-pointer"
                      onClick={() => handleViewRfp(rfp.id)}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 line-clamp-2">
                          {rfp.user_input}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
                          <span>Budget: {rfp.budgetCurrency} {parseFloat(rfp.budgetAmount).toLocaleString()}</span>
                          <span>Items: {rfp.items?.length || 0}</span>
                          <span>Proposals: {rfp.proposals?.length || 0}</span>
                          <span>{new Date(rfp.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewRfp(rfp.id);
                        }}
                        className="ml-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Start New RFP Proposal
              </h2>
              <form onSubmit={handleStartSession} className="space-y-4">
                <div>
                  <label
                    htmlFor="initial-message"
                    className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Describe your RFP requirements
                  </label>
                  <textarea
                    id="initial-message"
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="e.g., I need 10 laptops for my office with a budget of $15,000"
                    className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    rows={4}
                    disabled={!connected || isStarting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!connected || !initialMessage.trim() || isStarting}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {isStarting ? 'Starting...' : 'Start Session'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
