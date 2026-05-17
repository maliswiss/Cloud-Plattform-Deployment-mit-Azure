/**
 * Notiz-API — Cloud-Plattform Deployment auf Azure App Service
 * Auftrag C3 · Deployment LB1
 * Mehmet Ali Gür – HF Informatik
 */

import express from 'express';
import pkg from 'pg';
import pino from 'pino';
import pinoHttp from 'pino-http';
import 'dotenv/config';

const { Pool } = pkg;

// ─── Strukturierte JSON-Logs auf stdout ──────────────────────────────
// Erforderlich nach Aufgabenstellung: "Die Anwendung gibt strukturierte
// Logs aus, die über das Logging-Interface der Plattform einsehbar sind."
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

// ─── Express-App initialisieren ──────────────────────────────────────
const app = express();
app.use(express.json());
app.use(pinoHttp({ logger }));

// ─── Konfiguration ausschliesslich über Environment-Variablen ────────
// Werden auf der Plattform (Azure App Settings) gesetzt — nicht im Code.
const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.DATABASE_URL;

// ─── PostgreSQL-Verbindung (Azure Database for PostgreSQL) ───────────
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─── Datenbank-Schema initialisieren ─────────────────────────────────
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notizen (
      id SERIAL PRIMARY KEY,
      titel VARCHAR(200) NOT NULL,
      inhalt TEXT NOT NULL,
      erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  logger.info('Datenbank-Tabelle "notizen" bereit');
}

// ─── Root-Endpoint mit Übersicht ─────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <title>Notiz-API · Azure Deployment</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 720px; margin: 60px auto; padding: 0 24px; color: #1F3864; }
        h1 { border-bottom: 3px solid #C19A2E; padding-bottom: 12px; }
        code { background: #FFF4E0; padding: 2px 8px; border-radius: 4px; color: #C19A2E; font-weight: 600; }
        .endpoint { background: #F5F7FA; border-left: 4px solid #1565C0; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
        .method { display: inline-block; background: #2E7D32; color: white; padding: 2px 10px; border-radius: 3px; font-size: 12px; font-weight: 700; margin-right: 8px; }
        .method.post { background: #1565C0; }
        .method.delete { background: #C62828; }
        footer { margin-top: 40px; text-align: center; color: #888; font-style: italic; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1>Notiz-API · live auf Azure</h1>
      <p>Anwendung deployt im Rahmen des Auftrags <strong>C3 · Cloud-Plattform Deployment</strong>.</p>
      <h2>Verfügbare Endpoints</h2>
      <div class="endpoint"><span class="method">GET</span> <code>/api/notizen</code> — Alle Notizen abrufen</div>
      <div class="endpoint"><span class="method post">POST</span> <code>/api/notizen</code> — Neue Notiz erstellen</div>
      <div class="endpoint"><span class="method delete">DELETE</span> <code>/api/notizen/:id</code> — Notiz löschen</div>
      <footer>Mehmet Ali Gür · HF Informatik · GIBB Bern</footer>
    </body>
    </html>
  `);
});

// ─── Backend-Logik: CRUD-Endpoints (keine reine Statik-Seite) ────────
app.get('/api/notizen', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notizen ORDER BY erstellt_am DESC'
    );
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, 'Fehler beim Abrufen der Notizen');
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

app.post('/api/notizen', async (req, res) => {
  const { titel, inhalt } = req.body;
  if (!titel || !inhalt) {
    return res.status(400).json({ error: 'titel und inhalt sind erforderlich' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO notizen (titel, inhalt) VALUES ($1, $2) RETURNING *',
      [titel, inhalt]
    );
    logger.info({ id: result.rows[0].id }, 'Notiz erstellt');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error({ err }, 'Fehler beim Erstellen der Notiz');
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

app.delete('/api/notizen/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM notizen WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notiz nicht gefunden' });
    }
    logger.info({ id: req.params.id }, 'Notiz gelöscht');
    res.json({ message: 'Notiz gelöscht' });
  } catch (err) {
    logger.error({ err }, 'Fehler beim Löschen der Notiz');
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// ─── Server starten ──────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server gestartet');
  initDatabase().catch((err) =>
    logger.error({ err }, 'Datenbank-Initialisierung fehlgeschlagen')
  );
});
