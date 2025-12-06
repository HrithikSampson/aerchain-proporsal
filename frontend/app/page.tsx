'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProposalSocket } from './hooks/useProposalSocket';

export default function Home() {
  const router = useRouter();
  const { connected, rooms, fetchRooms } = useProposalSocket();

  const [initialMessage, setInitialMessage] = useState('');
  const [showRooms, setShowRooms] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialMessage.trim() && !isStarting) {
      setIsStarting(true);
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
        // Create a new session via REST API
        const response = await fetch(`${backendUrl}/proposal/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();
        const { roomId } = data;

        // Store the initial message in sessionStorage to be picked up by the room page
        sessionStorage.setItem(`room-${roomId}-initial`, initialMessage.trim());

        // Redirect to the room
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
      </main>
    </div>
  );
}
