import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Patch ResizeObserver to schedule callbacks on next frame to avoid loop errors in Chrome
try {
  const OR = window.ResizeObserver;
  if (OR) {
    window.ResizeObserver = class extends OR {
      constructor(callback) {
        super((entries, observer) => {
          requestAnimationFrame(() => callback(entries, observer));
        });
      }
    };
  }
} catch (_) {}

const root = ReactDOM.createRoot(document.getElementById("root"));
// Final guard: swallow only ResizeObserver runtime errors at the global handler level
window.onerror = (message, source, lineno, colno, error) => {
  try {
    const msg = typeof message === 'string' ? message : (error?.message || '');
    if (msg && (msg.includes('ResizeObserver loop completed') || msg.includes('ResizeObserver loop limit exceeded'))) {
      return true; // Prevent default handling (stops React overlay)
    }
  } catch (_) {}
  return false;
};

window.onunhandledrejection = (event) => {
  try {
    const msg = event?.reason?.message || '';
    if (msg && (msg.includes('ResizeObserver loop completed') || msg.includes('ResizeObserver loop limit exceeded'))) {
      event.preventDefault();
      return true;
    }
  } catch (_) {}
  return false;
};

// Filter out noisy ResizeObserver runtime errors that trigger React overlay in dev
const ignoreROError = (event) => {
  const msg = event?.message || event?.reason?.message || '';
  if (typeof msg === 'string' && (msg.includes('ResizeObserver loop completed') || msg.includes('ResizeObserver loop limit exceeded'))) {
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  }
};
window.addEventListener('error', ignoreROError, true);
window.addEventListener('unhandledrejection', ignoreROError, true);

// Optional: mitigate noisy ResizeObserver loop errors in dev
const roError = /(ResizeObserver loop completed with undelivered notifications)/;
const origConsoleError = console.error;
console.error = (...args) => {
  if (args && args[0] && typeof args[0] === 'string' && roError.test(args[0])) {
    return; // swallow noisy dev-time error
  }
  origConsoleError(...args);
};

// Disable StrictMode in preview to avoid double-render & noisy RO loops
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);
