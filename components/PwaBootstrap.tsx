'use client';

import { useEffect } from 'react';

const getBasePath = () => {
  const path = window.location.pathname;
  const match = path.match(/^\/[^/]+/);

  if (!match) {
    return '';
  }

  const candidate = match[0];
  return candidate === '/recall' ? candidate : '';
};

export default function PwaBootstrap() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const basePath = getBasePath();
    const swPath = basePath ? `${basePath}/sw.js` : '/sw.js';

    void navigator.serviceWorker
      .register(swPath)
      .catch(() => undefined);
  }, []);

  return null;
}
