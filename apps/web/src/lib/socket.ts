import { io, type Socket } from 'socket.io-client';
import { refreshSession } from './api';
import { useAuth } from '@/stores/auth';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
    // Called on every (re)connect, so a rotated access token is always used.
    auth: (cb) => cb({ token: useAuth.getState().accessToken }),
  });
  let retriedAuth = false;
  socket.on('connect', () => (retriedAuth = false));
  socket.on('connect_error', async (err) => {
    if (err.message !== 'UNAUTHORIZED' || retriedAuth) return;
    retriedAuth = true;
    if (await refreshSession()) socket?.connect();
  });
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
