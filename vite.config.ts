import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { chefAvailable, generateDish } from './server/chef';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Server-side AI chef endpoint so the API key never reaches the browser. */
function chefApi(): Plugin {
  return {
    name: 'low-and-slow-chef-api',
    configureServer(server) {
      server.middlewares.use('/api/chef', async (req, res) => {
        if (req.method === 'GET') return sendJson(res, 200, { available: chefAvailable() });
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        try {
          const { request, kamadoName } = JSON.parse(await readBody(req)) as { request?: string; kamadoName?: string };
          if (!request || request.trim().length < 3) return sendJson(res, 400, { error: 'Beschrijf wat je wilt maken.' });
          const dish = await generateDish(request.trim().slice(0, 300), kamadoName ?? 'kamado');
          sendJson(res, 200, { dish });
        } catch (err) {
          console.error('[chef]', err);
          sendJson(res, 502, { error: 'De AI-chef is even niet bereikbaar. Kies een recept uit de lijst.' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), chefApi()],
  server: { port: 5173, open: true },
});
