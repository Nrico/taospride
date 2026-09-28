# Taos Pride

Source for [taospride.org](https://taospride.org), including the public event
site, photo gallery, unified site/board/gallery administration, and the PHP API
used on GoDaddy shared hosting.

## Local development

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `DEV_ADMIN_PASSWORD` in `.env.local` before using the local admin. Local
JSON state is written under `data/` and is intentionally excluded from Git.

Useful commands:

```bash
npm run lint
npm run build
npm run preview
```

## Production configuration

Copy `api/config.example.php` to `api/config.php`, provide the production
database credentials and a unique session key, and keep that file outside Git.
Production site content and credentials live in MySQL; the schema is in
`database/schema.sql`.

See [DEPLOY.md](DEPLOY.md) for the GoDaddy deployment and verification steps.
The current product and content assessment is in [SITE_REVIEW.md](SITE_REVIEW.md).

## Security

Never commit `.env.local`, `api/config.php`, files under `data/`, uploaded board
or vault documents, database exports, or production photo uploads.
