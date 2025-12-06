'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useProposalSocket } from '../../hooks/useProposalSocket';
import Link from 'next/link';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const {
    connected,
    rfpId,
    messages,
    currentQuestion,
    isComplete,
    error,
    startNewSession,
    joinRoom,
    sendAnswer,
  } = useProposalSocket();

  const [answerInput, setAnswerInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (connected && roomId && !rfpId) {
      const initialMessage = sessionStorage.getItem(`room-${roomId}-initial`);

      if (initialMessage) {
        sessionStorage.removeItem(`room-${roomId}-initial`);
        startNewSession(initialMessage, roomId);
      } else {
        joinRoom(roomId);
      }
    }
  }, [connected, roomId, rfpId, startNewSession, joinRoom]);

  useEffect(() => {
    if (isComplete) {
      router.push('/');
    }
  }, [isComplete, router]);

  const handleSendAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (answerInput.trim() && !isComplete) {
      sendAnswer(answerInput.trim());
      setAnswerInput('');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                ← Back to Home
              </Link>
              <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                RFP Proposal Room
              </h1>
            </div>
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
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Room ID:{' '}
              <span className="font-mono text-zinc-900 dark:text-zinc-50">
                {roomId}
              </span>
            </div>
            {isComplete && (
              <div className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">
                ✓ Proposal completed and saved
              </div>
            )}
          </div>

          <div className="flex-1 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="h-96 space-y-4 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-zinc-500 dark:text-zinc-500">
                  {connected ? 'Connecting to room...' : 'Connecting...'}
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                    }`}
                  >
                    <div className="mb-1 text-xs font-medium opacity-70">
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className="text-sm">{msg.content}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="border-t border-zinc-200 bg-red-50 p-4 text-sm text-red-600 dark:border-zinc-800 dark:bg-red-950 dark:text-red-400">
                Error: {error}
              </div>
            )}

            {!isComplete && (
              <form
                onSubmit={handleSendAnswer}
                className="border-t border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder={
                      currentQuestion
                        ? 'Type your answer...'
                        : 'Waiting for question...'
                    }
                    className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    disabled={!connected || isComplete}
                  />
                  <button
                    type="submit"
                    disabled={!connected || !answerInput.trim() || isComplete}
                    className="rounded-lg bg-zinc-900 px-6 py-2 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Send
                  </button>
                </div>
              </form>
            )}
          </div>

          {isComplete && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
              <h3 className="font-semibold text-green-900 dark:text-green-100">
                Session Complete
              </h3>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Your RFP proposal has been successfully saved. You can now close this window.
              </p>
              <Link
                href="/"
                className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              >
                Start New Proposal
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
