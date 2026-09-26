import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_ORIGIN = new URL(API_URL, window.location.origin).origin;

export function createInboxSocket(token) {
  return io(SOCKET_ORIGIN, { autoConnect: false, auth: { token }, reconnection: true });
}
