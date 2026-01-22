<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1vx_ZOe71v_Gy4bWTwn4ITYJlsQLhZ37y



**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.sample` to `.env.local` and set your server-side Gemini API key:
   `GEMINI_API_KEY=your_gemini_api_key_here`
   (Keep this secret and do NOT commit it to git)
3. Start the server proxy (runs on port 3001 by default):
   `npm run server`
4. Run the frontend in a separate terminal:
   `npm run dev`

Troubleshooting — "Server proxy error":
- Ensure the server proxy is running: open a terminal and run `npm run server` (defaults to port 3001). Check the terminal for "Server proxy listening on http://localhost:3001".
- By default the Vite dev server is configured to proxy `/api` to `http://localhost:3001`. If your server runs on a different host/port set `VITE_API_SERVER_URL` in `.env.local` (for example `VITE_API_SERVER_URL=http://localhost:3001`) and restart the dev server.
- If you still see "Server proxy error", open DevTools → Network and inspect the POST `/api/generate` response to see the server error message (or check server terminal logs).

Security note: If you accidentally exposed an API key (for example by pasting it into a chat or committing it), rotate/revoke that key immediately in Google Cloud Console.
