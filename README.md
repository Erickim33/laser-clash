# LASER CLASH — launch-ready web + multiplayer server

This package combines the selected `laser-clash-real-build.html` frontend with the Node.js/WebSocket multiplayer server and the Overload Protocol server logic.

## Run locally on Windows
1. Install Node.js 22 LTS.
2. Open PowerShell in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

The frontend connects to the same host at `/ws`, so it must be served by the multiplayer server. A static-only host such as Vercel cannot run this WebSocket server by itself.

## Deploy the online game on Render
1. Push this folder's contents to a GitHub repository (the `package.json`, `server.ts`, `src`, `dist`, and `render.yaml` must be at repository root).
2. In Render, create a new **Web Service** from that repository.
3. Render should read `render.yaml`. Confirm build command `npm install --no-audit --no-fund` and start command `npm start`.
4. After deploy, open the service URL and verify `/api/health` returns JSON with `status: "ok"`.
5. Open the service's root URL to play. Share that URL with other players; they must use the same service URL to meet in the same room.

The included `render.yaml` configures a free service for a first launch. Free services can spin down when idle, so the first connection may take a little time and an idle service may interrupt matches. For a reliable always-on public launch, use a paid always-on Node service.

## Nexeric Games website
Keep the main Nexeric Games site on Vercel if you like. Add a game card linking to the Render service URL once deployed. Do not upload this HTML alone to the static site if you want real multiplayer; the `/ws` and `/api` routes must be served by the Node server.

## Android
This package is not yet an Android APK. First deploy and verify the online server. Android packaging requires a Capacitor wrapper configured to connect to the deployed server; this build uses same-origin WebSockets, so wrapping it without that configuration will not connect to online matches.

## Health and endpoints
- `/api/health` — deployment health check
- `/api/rooms` — current room summary
- `/ws` — real-time multiplayer WebSocket
- `/api/download-zip` — source archive download
