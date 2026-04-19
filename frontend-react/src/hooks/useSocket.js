import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}

/**
 * Hook to subscribe to Socket.IO events and auto-refresh data.
 * @param {string|string[]} events - Event name(s) to listen for
 * @param {Function} callback - Called when any of the events fire
 */
export function useSocketEvent(events, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const s = getSocket();
    const eventList = Array.isArray(events) ? events : [events];

    const handler = (data) => {
      callbackRef.current(data);
    };

    eventList.forEach((ev) => s.on(ev, handler));

    return () => {
      eventList.forEach((ev) => s.off(ev, handler));
    };
  }, [events]);
}

export { getSocket };
