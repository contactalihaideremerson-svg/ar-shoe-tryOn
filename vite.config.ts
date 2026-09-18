import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // HTTPS is on by default (needed for camera access from a phone on the LAN
  // — see the `server.host` comment below). Set VITE_NO_SSL=1 to run plain
  // HTTP instead, e.g. for tooling that can't handle a self-signed cert.
  plugins: [react(), ...(process.env.VITE_NO_SSL ? [] : [basicSsl()])],
  server: {
    // Bind to the LAN, not just localhost, so a phone on the same Wi-Fi can
    // reach it. HTTPS (via basicSsl above) is required for that case —
    // getUserMedia only waives the secure-context requirement for
    // `localhost` itself, not for another device hitting your machine's IP.
    host: true,
  },
})
