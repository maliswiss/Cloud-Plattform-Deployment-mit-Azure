<div align="center">

# Cloud-Plattform-Deployment-mit-Azure

**Auftrag C3 · Deployment LB1**  
*Mehmet Ali Gür · HF Informatik · GIBB Bern · Mai 2026*

![Platform](https://img.shields.io/badge/Plattform-Azure_App_Service-1565C0?style=flat-square&logo=microsoftazure)
![Runtime](https://img.shields.io/badge/Runtime-Node.js_22_LTS-339933?style=flat-square&logo=node.js)
![Database](https://img.shields.io/badge/Datenbank-PostgreSQL_16-336791?style=flat-square&logo=postgresql)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=flat-square&logo=githubactions)
![Status](https://img.shields.io/badge/Status-live-2E7D32?style=flat-square)

**Öffentliche URL:** [https://mali-notiz-api-c3.azurewebsites.net](https://mali-notiz-api-c3.azurewebsites.net)

</div>

---

## 1 · Umsetzung und Plattform-Wahl

Die Anwendung ist eine in Node.js (Express) geschriebene **Notiz-API** mit CRUD-Funktionalität und PostgreSQL-Persistenz. Sie ist öffentlich unter `https://mali-notiz-api-c3.azurewebsites.net` per HTTPS erreichbar und wird automatisiert bei jedem Push auf den `main`-Branch via **GitHub Actions** auf **Microsoft Azure App Service** deployt.

**Warum Azure App Service?**

- **Managed Linux Container** ohne eigene VM-Verwaltung — Hosting, Skalierung und TLS-Zertifikate übernimmt die Plattform.
- **Native Integration mit GitHub Actions** über das offizielle `azure/webapps-deploy@v3`-Action mit Publish-Profile-Authentifizierung.
- **Free Tier (F1)** im Rahmen des Azure-for-Students-Abos — ausreichend für den Auftrag (kein Production-Workload).
- **Plattform-Logging via Log Stream** ermöglicht das direkte Einsehen strukturierter JSON-Logs ohne zusätzliche Tools.
- **Azure Database for PostgreSQL Flexible Server** als angebundener Managed-Datenspeicher in derselben Resource Group — Daten überstehen Neustarts und Redeploys.

---

## 2 · Architektur

```text
   Entwickler                GitHub                       Microsoft Azure
   ──────────       ─────────────────────       ───────────────────────────────
                                                 ┌─────────────────────────┐
   ┌────────┐      ┌──────────────────┐         │  Resource Group         │
   │  Push  │ ───► │  Repository      │         │  rg-cloud-deployment-   │
   │  main  │      │  +  Workflow     │ ──────► │  mali  (Austria East)   │
   └────────┘      │  deploy-azure.yml│  ZIP    │                         │
                   └──────────────────┘ Deploy  │  ┌──────────────────┐   │
                                                │  │ App Service (F1) │   │
                                                │  │ mali-notiz-api-c3│   │
                                                │  │ Node 22 · Linux  │   │
                                                │  └────────┬─────────┘   │
                                                │           │ SSL (5432)  │
                                                │           ▼             │
                                                │  ┌──────────────────┐   │
                                                │  │ PostgreSQL (B1ms)│   │
                                                │  │ 32 GiB · Flexible│   │
                                                │  └──────────────────┘   │
                                                └─────────────────────────┘
                                                            ▲
                                                            │ HTTPS
                                                ┌─────────────────────────┐
                                                │  Öffentliche URL        │
                                                │  azurewebsites.net      │
                                                └─────────────────────────┘
```

Eine farbige Version des Diagramms ist unter [`docs/architektur.png`](docs/architektur.png) verfügbar.

**Komponenten:**

| Komponente | Rolle | Konfiguration |
|---|---|---|
| **App Service** | Hosted Express-API, HTTPS-Endpoint, automatisches TLS | Linux · Node 22 LTS · F1 Free |
| **PostgreSQL Flexible Server** | Persistenter Datenspeicher | B1ms · 32 GiB · Public Access mit Firewall |
| **GitHub Actions** | Auto-Deployment bei Push auf `main` | Workflow `deploy-azure.yml` (Build + Deploy) |
| **App Settings** | Environment-Variablen auf der Plattform | `DATABASE_URL`, `PORT`, `WEBSITES_PORT` |
| **Log Stream** | Plattform-natives Logging-Interface | Strukturierte JSON-Logs (Pino) |

---

## 3 · Setup-Anleitung (durch Dritte reproduzierbar)

Die folgenden sieben Schritte ermöglichen einer dritten Person, das Deployment vollständig zu reproduzieren. Voraussetzungen: ein Azure-Abo (z. B. *Azure for Students*) und ein GitHub-Konto.

**Schritt 1 — Azure Resource Group anlegen**

```bash
az group create --name rg-cloud-deployment-mali --location austriaeast
```

**Schritt 2 — PostgreSQL Flexible Server anlegen**

Im Azure Portal: *Azure Database for PostgreSQL → flexible servers → Create*. Werte: Region `Austria East`, Workload `Dev/Test`, Tier `Burstable B1ms`, Storage `32 GiB`, Authentication `PostgreSQL only`, Admin `maliadmin`. Im Tab *Networking* die Firewall-Regel `0.0.0.0 – 255.255.255.255` setzen und «Allow public access from any Azure service» aktivieren.

**Schritt 3 — App Service (Web App) anlegen**

Im Portal: *App Services → Create → Web App*. Werte: Resource Group `rg-cloud-deployment-mali`, Runtime `Node 22 LTS`, OS `Linux`, Region `Austria East`, Pricing Plan `Free F1`. Basic Authentication aktiviert lassen.

**Schritt 4 — Environment-Variablen setzen**

In *App Service → Settings → Environment variables* drei Einträge anlegen:

- `DATABASE_URL` = `postgres://maliadmin:<PASSWORT>@pg-notiz-mali-we-2026.postgres.database.azure.com:5432/postgres?sslmode=require`
- `PORT` = `8080`
- `WEBSITES_PORT` = `8080`

**Schritt 5 — Publish Profile herunterladen**

In *App Service → Overview → Download publish profile*. Den vollständigen XML-Inhalt der `.PublishSettings`-Datei kopieren.

**Schritt 6 — GitHub Secret anlegen**

Im Repository unter *Settings → Secrets and variables → Actions → New repository secret*: Name `AZURE_WEBAPP_PUBLISH_PROFILE`, Wert = kopierter XML-Inhalt aus Schritt 5.

**Schritt 7 — Deployment auslösen**

```bash
git clone https://github.com/maliswiss/Cloud-Plattform-Deployment-mit-Azure.git
cd Cloud-Plattform-Deployment-mit-Azure
git commit --allow-empty -m "Trigger initial deployment"
git push origin main
```

Der Workflow startet automatisch unter *Actions* und ist nach etwa 40 Sekunden abgeschlossen. Die Anwendung ist anschliessend unter der Default-Domain des App Service erreichbar.

---

## 4 · Konfigurationsausschnitte

**`src/server.js` — Konfiguration ausschliesslich über Environment-Variablen**

```javascript
const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }    // Azure PostgreSQL erfordert SSL
});
```

**`src/server.js` — Strukturierte JSON-Logs via Pino**

```javascript
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger }));
```

**`.github/workflows/deploy-azure.yml` — Auto-Deployment bei Push**

```yaml
on:
  push:
    branches: [main]

env:
  AZURE_WEBAPP_NAME: mali-notiz-api-c3
  NODE_VERSION: '22.x'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci --omit=dev
      - run: zip -r release.zip . -x "*.git*" ".github/*" "docs/*" "*.md" ".env*"
      - uses: actions/upload-artifact@v4
        with: { name: node-app, path: release.zip }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { name: node-app }
      - uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ env.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: release.zip
```

**`.env.example` — Schablone (im Repository, keine echten Secrets)**

```bash
DATABASE_URL=postgres://user:password@localhost:5432/notizen
PORT=8080
NODE_ENV=production
LOG_LEVEL=info
```

---

## 5 · API-Endpoints

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/` | HTML-Übersichtsseite mit Endpoint-Dokumentation |
| `GET` | `/api/notizen` | Alle Notizen abrufen (JSON-Array) |
| `POST` | `/api/notizen` | Neue Notiz erstellen (Body: `{ titel, inhalt }`) |
| `DELETE` | `/api/notizen/:id` | Notiz mit angegebener ID löschen |

**Beispiel-Aufrufe:**

```bash
# Notiz erstellen
curl -X POST https://mali-notiz-api-c3.azurewebsites.net/api/notizen \
  -H "Content-Type: application/json" \
  -d '{"titel":"Demo","inhalt":"Hallo Azure"}'

# Alle Notizen abrufen
curl https://mali-notiz-api-c3.azurewebsites.net/api/notizen
```

---

## 6 · Projekt-Struktur

```text
Cloud-Plattform-Deployment-mit-Azure/
├── .github/
│   └── workflows/
│       └── deploy-azure.yml      GitHub Actions Workflow
├── docs/
│   └── architektur.png            Architektur-Diagramm
├── src/
│   └── server.js                  Express-Anwendung
├── .env.example                   Schablone (keine Secrets)
├── .gitignore                     Verhindert .env-Push
├── package.json                   Abhängigkeiten + Start-Script
├── package-lock.json              Deterministische Builds
└── README.md                      Dieses Dokument
```

---

<div align="center">

### Hinweis zum Einsatz von KI

*In diesem Projekt wurde bei der Erstellung der Dokumentation und einzelner Codeabschnitte teilweise KI (Künstliche Intelligenz) eingesetzt. Sämtliche generierten Inhalte wurden geprüft, angepasst und sind vom Autor inhaltlich nachvollziehbar.*

**Mehmet Ali Gür**

</div>
