import express from 'express';
import supabase from './lib/supabase';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  // Supabase client is initialized on import for readiness; no calls yet.
  void supabase;
  console.log(`Server listening on port ${port}`);
});
