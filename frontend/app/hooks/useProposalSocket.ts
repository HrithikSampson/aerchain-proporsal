'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

type Message = {
  role: 'user' | 'llm';
  content: string;
};

type RoomInfo = {
  rfpId: string;
  lastActivityAt: Date;
  participantCount: number;
};

export function useProposalSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [rfpId, setRfpId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const socketInstance = io(`${backendUrl}/proposal`, {
      path: '/proposal-socket',
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('Connected to socket');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from socket');
      setConnected(false);
    });

    socketInstance.on('proposal:joined', (data: { message: string; rfpId: string }) => {
      console.log('Joined room:', data);
      setRfpId(data.rfpId);
    });

    socketInstance.on('proposal:question', (data: { question: string; currentState: any; missingFields: string[] }) => {
      console.log('New question:', data);
      setCurrentQuestion(data.question);
      setMessages(prev => [...prev, { role: 'llm', content: data.question }]);
    });

    socketInstance.on('proposal:complete', (data: { message: string; proposal: any; rfpCore: any }) => {
      console.log('Proposal complete:', data);
      setIsComplete(true);
      setCurrentQuestion(null);
      setMessages(prev => [...prev, { role: 'llm', content: data.message }]);
    });

    socketInstance.on('proposal:error', (data: { message: string; error?: string }) => {
      console.error('Error:', data);
      setError(data.message);
    });

    socketInstance.on('proposal:end', (data: { reason: string }) => {
      console.log('Session ended:', data);
      setError(data.reason);
      setIsComplete(true);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const startNewSession = useCallback((initialMessage: string, roomId?: string) => {
    if (!socket) return;

    setMessages([{ role: 'user', content: initialMessage }]);
    setIsComplete(false);
    setError(null);

    socket.emit('proposal:join', { message: initialMessage, roomId });
  }, [socket]);

  const joinRoom = useCallback((roomId: string) => {
    if (!socket) return;

    setIsComplete(false);
    setError(null);

    socket.emit('proposal:join', { roomId });
  }, [socket]);

  const sendAnswer = useCallback((answer: string, userId: string = 'user-123') => {
    if (!socket || !rfpId) return;

    setMessages(prev => [...prev, { role: 'user', content: answer }]);

    socket.emit('proposal:answer', {
      rfpId,
      userId,
      answer,
    });
  }, [socket, rfpId]);

  const fetchRooms = useCallback(async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/proposal/rooms`);
      const data = await response.json();
      setRooms(data.rooms);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  }, []);

  return {
    connected,
    rfpId,
    messages,
    currentQuestion,
    isComplete,
    error,
    rooms,
    startNewSession,
    joinRoom,
    sendAnswer,
    fetchRooms,
  };
}
