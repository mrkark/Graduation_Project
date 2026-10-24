import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '../api/client';

const SOCKET_URL = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');

let globalSocket = null;
let activeSubscribers = 0;

export function disconnectSocket() {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
    activeSubscribers = 0;
  }
}

export function useChatSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    if (!globalSocket || globalSocket.disconnected) {
      globalSocket = io(SOCKET_URL, {
        auth: { token },
        withCredentials: true,
      });

      globalSocket.io.on('reconnect_attempt', () => {
        if (globalSocket) {
          globalSocket.auth.token = getAccessToken();
        }
      });
    }

    const socket = globalSocket;
    socketRef.current = socket;
    activeSubscribers++;
    setConnected(socket.connected);

    function handleConnect() {
      setConnected(true);
    }
    function handleDisconnect() {
      setConnected(false);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      activeSubscribers--;
    };
  }, []);

  return { socket: socketRef, connected };
}

