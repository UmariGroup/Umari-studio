export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  // Already available
  if ((window as any).google?.accounts?.id) return Promise.resolve();

  const existing = document.getElementById('google-identity-services');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true } as any);
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Identity Services')),
        { once: true } as any
      );

      // If script loaded but window.google isn't ready yet, retry briefly.
      const start = Date.now();
      const tick = () => {
        if ((window as any).google?.accounts?.id) return resolve();
        if (Date.now() - start > 8000) return reject(new Error('Google Identity Services not available'));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'google-identity-services';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const start = Date.now();
      const tick = () => {
        if ((window as any).google?.accounts?.id) return resolve();
        if (Date.now() - start > 8000) return reject(new Error('Google Identity Services not available'));
        setTimeout(tick, 50);
      };
      tick();
    };

    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));

    document.head.appendChild(script);
  });
}
