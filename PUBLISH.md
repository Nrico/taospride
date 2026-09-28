# Publish Taos Pride to GoDaddy

The React source files cannot be uploaded directly. Vite first compiles them
into browser-ready HTML, CSS, and JavaScript. The project now builds and packages
everything needed for cPanel with one command.

## Make the upload package

Open Terminal in this project directory and run:

```bash
npm run release
```

When it finishes, open the new `release` folder. It contains:

- `taospride-cpanel.zip` — upload this file to GoDaddy.
- `UPLOAD-INSTRUCTIONS.txt` — the short cPanel checklist.
- `public_html/` — the same files unpacked, useful for inspection or FTP.

## Upload with cPanel File Manager

1. Sign in to GoDaddy cPanel and open **File Manager**.
2. Open the existing **public_html** directory.
3. Upload `release/taospride-cpanel.zip` there.
4. Select the ZIP and click **Extract**. Extract it into `public_html`.
5. Confirm file replacement when asked.
6. Delete the ZIP from the server after extraction.
7. Check [the homepage](https://taospride.org) and
   [the API health check](https://taospride.org/api/health).

The package does not contain or replace `api/config.php`, uploaded board/vault
documents, or gallery photos. Never delete the existing `public_html` directory
before extracting the package; those server-only files must remain in place.

## Security deployment order

When deploying the hash-only authentication update, complete the password-hash
database migration in `DEPLOY.md` before extracting the new package. This avoids
locking administrators out between the database and PHP updates.
