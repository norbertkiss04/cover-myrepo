import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error('No auth token available for socket connection');
  }

  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function reconnectWithNewToken(): void {
  if (socket) {
    const token = getAccessToken();
    if (token) {
      socket.auth = { token };
      socket.disconnect().connect();
    }
  }
}
