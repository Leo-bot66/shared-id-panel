# Shared Apple ID Panel

English | [简体中文](README.md)

A **self-hosted panel for sharing Apple IDs**: import accounts → open the page → visitors see each region's accounts with live status and one-click copy.

Built for the common scenario of distributing **shared Apple IDs** so users can download region-locked apps from the App Store (e.g. Shadowrocket, Quantumult X). Works out of the box.

## 📷 Preview

| Home | Account list |
|---|---|
| ![Home](docs/preview-home.png) | ![Account list](docs/preview-accounts.png) |

```
Import accounts   →  node cli/import.js accounts.json
Start the service →  docker compose up -d
Open              →  http://localhost:3000
```

---

## ✨ Features

| Feature | Description |
|---|---|
| **Zero-config start** | One command to create the DB, one to import, one to serve. No code required. |
| **Password on demand** | The homepage HTML contains **no plaintext passwords**. They are fetched only when a visitor clicks "Show password" — bulk scraping the page yields nothing. |
| **Region grouping** | Automatic `US` / `HK` / `TW` / `JP` badges; any custom region name works. |
| **Status badges** | `available` / `unavailable` rendered with distinct colours. |
| **One-click copy** | Copy the account email, or fetch and copy the password. |
| **SEO friendly** | Server-side rendered (not an empty SPA shell), with canonical / OpenGraph / JSON-LD generated automatically. |
| **Docker ready** | Ships with `Dockerfile` and `docker-compose.yml`; data is persisted on the host. |
| **Lightweight** | Node + Express + SQLite, no external services. |

---

## 🚀 Quick start

### Option 1 — Docker (recommended)

```bash
git clone https://github.com/Leo-bot66/shared-id-panel.git
cd shared-id-panel

# Import accounts (creates data/panel.db)
docker compose run --rm panel node cli/import.js examples/accounts.sample.json

# Start
docker compose up -d
```

Open `http://localhost:3000`.

### Option 2 — Run locally

Requires Node.js 18 or newer.

```bash
npm install
cp .env.example .env          # edit site name etc. if needed

node cli/import.js examples/accounts.sample.json
npm start
```

---

## 📥 Importing accounts

Supports **JSON**, **CSV**, and reading from **stdin**.

```bash
node cli/import.js accounts.json           # JSON array
node cli/import.js accounts.csv            # CSV (first row = header)
cat accounts.json | node cli/import.js -   # stdin

node cli/import.js accounts.json --dry-run          # parse only, do not write
node cli/import.js accounts.json --region US        # default region for rows missing one
```

### JSON shape

```json
[
  {
    "email": "account@example.com",
    "password": "YourPassword",
    "region": "US",
    "status": "available",
    "note": "optional note",
    "sort_order": 10
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `email` | ✅ | Account. Aliases: `account`, `username`, `mail` |
| `password` | ✅ | Aliases: `pwd`, `pass` |
| `region` | — | Defaults to `未分区`. Aliases: `country`, `area` |
| `status` | — | `available` / `unavailable` / `hidden` |
| `note` | — | Aliases: `remark`, `comment` |
| `sort_order` | — | Lower sorts first |

> Re-importing **upserts by `email`**, so you can periodically push your latest list and changed passwords sync automatically.

---

## ⚙️ Configuration

Everything is configured via environment variables (or a `.env` file):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Listen port |
| `SITE_NAME` | `共享 Apple ID 面板` | Site name (title / OpenGraph) |
| `SITE_URL` | `http://localhost:3000` | Public URL. **Affects canonical & share links — set this to your real domain.** |
| `SITE_DESCRIPTION` | see `.env.example` | Meta description |
| `DATA_DIR` | `./data` | SQLite directory |
| `REVEAL_ON_CLICK` | `true` | When `true`, the homepage never renders plaintext passwords. Keep it on. |
| `SHOW_UPDATED_AT` | `true` | Show account update timestamps |
| `FOOTER_NOTE` | see `.env.example` | Disclaimer under the account list |

---

## 🔌 API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/accounts` | Account list (excludes `password` when `REVEAL_ON_CLICK=true`) |
| `GET` | `/api/accounts/:id/password` | Fetch a single password on demand |
| `GET` | `/healthz` | Health check with account stats |

```bash
curl http://localhost:3000/api/accounts
# {"ok":true,"total":4,"data":[{"id":1,"email":"...","region":"US","regionCode":"US","status":"available"}]}

curl http://localhost:3000/api/accounts/1/password
# {"ok":true,"data":{"id":1,"password":"..."}}
```

---

## 🔒 Security notes

Sites like this are a prime target for bulk password scraping. Two mitigations are enabled by default:

1. **No plaintext passwords in server output** — with `REVEAL_ON_CLICK=true`, neither the homepage HTML nor `/api/accounts` includes the `password` field. It is only obtainable per-account via `/api/accounts/:id/password`.
2. **No-cache responses** — the password endpoint returns `Cache-Control: no-store`.

> ⚠️ Be clear-eyed about this: it **raises the cost of scraping, it is not a security boundary.** Anyone who can reach `/api/accounts/:id/password` can read the password.
> For stronger protection, add your own layer at the reverse proxy (Nginx / Cloudflare): **rate limiting** (e.g. 10 req/min per IP), **bot challenges** (Turnstile), or an **IP allow/deny list**.

---

## 📁 Project layout

```
shared-id-panel/
├── server.js                  # Express entry (pages + API)
├── src/
│   ├── config.js              # Env configuration
│   └── db.js                  # SQLite init & data access
├── views/
│   └── index.ejs              # Homepage template (SSR)
├── public/static/
│   ├── css/                   # Styles
│   └── js/panel.js            # Front-end interactions
├── cli/import.js              # Account import CLI
├── examples/                  # Sample data
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## ❓ FAQ

**Does it rotate or refresh account passwords automatically?**
No, and that is intentional. This project only **displays** accounts. How you obtain them (manual curation, an upstream API, your own script) is up to you — push the latest list with `import`. Keeping "obtain accounts" and "display accounts" separate is a deliberate boundary.

**Does it support multiple users or login?**
No. It is a read-only display panel with no admin UI and no user system. For access control, put Nginx Basic Auth or Cloudflare Access in front.

**Why server-side rendering instead of an SPA?**
SSR is friendlier to search engines. Sites like this exist to be **found**, and an empty SPA shell starts at a disadvantage.

**Where is the data stored?**
`data/panel.db` (SQLite). With Docker it is mounted to `./data` on the host, so rebuilding the container does not lose data.

---

## 📄 Disclaimer

This project is a **technical demo and self-hosting tool**. It does not provide, host, or distribute any Apple ID account data.
Users are responsible for ensuring that the accounts they display are obtained lawfully and used in accordance with Apple's terms of service and applicable local law.
Any consequences of using this project are borne by the user.

## License

[MIT](LICENSE)
