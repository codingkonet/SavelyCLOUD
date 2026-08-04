# SavelyCLOUD

A small, dependency-free private cloud you can run on your own computer. It provides local user accounts and a clean browser interface for uploading, organizing, downloading, searching, and deleting files. Each account has an isolated private storage area.

SavelyCLOUD can also connect each account to external storage. It supports:

- Google Drive through Google OAuth 2.0
- Supabase Storage through its S3-compatible server API
- WebDAV services such as Nextcloud, ownCloud, Koofr, and other standards-compatible servers
- S3-compatible services such as AWS S3, Cloudflare R2, Backblaze B2, MinIO, and similar object stores

Open **Connected storage** after signing in to add, browse, upload to, download from, or unlink a service. Provider credentials are encrypted locally with AES-256-GCM before they are written to disk.

## Start it

Requires Node.js 20 or newer.

```powershell
npm start
```

Then open <http://127.0.0.1:8787> and create your first account. Files are stored in the `storage/accounts` folder, while salted password hashes are kept in `.local-cloud-data/accounts.json`. Both locations are excluded from Git.

The first account created becomes the administrator. The admin panel can review usage, set per-user quotas, promote administrators, suspend accounts, browse or delete user files, and delete accounts.

### One-click start on Windows

Double-click `start-local.cmd`. This is the recommended Windows launcher and works even when PowerShell script execution is disabled.

You can also run the server directly:

```powershell
node server.js
```

If your system allows local PowerShell scripts, the configurable launcher is:

```powershell
.\start-local.ps1
```

For access from other devices on your LAN:

```powershell
.\start-local.ps1 -NetworkAccess
```

### Docker Compose

```powershell
docker compose up -d --build
```

The Compose setup includes persistent volumes, automatic restart, and a health check. Copy `.env.example` to `.env` to customize storage limits. Stop it with `docker compose down`; your named-volume data remains intact.

## Connect Google Drive

Google requires your own OAuth credentials for a locally hosted app:

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project and enable the Google Drive API.
2. Configure the OAuth consent screen. While the app is in testing mode, add the Google accounts that may connect as test users.
3. Create an OAuth client with application type **Web application**.
4. Add this exact authorized redirect URI: `http://127.0.0.1:8787/api/connections/google/callback`.
5. Copy `.env.example` to `.env`, fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and restart SavelyCLOUD.
6. Sign in, open **Connected storage**, select **Google Drive**, and approve access on Google's page.

After connecting, use **Settings** on the Google Drive card to rename it, refresh the displayed Google account information, or reconnect and switch the authorized Google account without creating a duplicate connection.

SavelyCLOUD requests offline access so it can refresh short-lived access tokens. It requests the full Drive scope because its built-in browser manages existing files; Google classifies that scope as restricted and may require OAuth app verification if you publish the app beyond configured test users. See Google's [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) and [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

## Connect Supabase Storage

1. Open your Supabase project and create or choose a Storage bucket.
2. In **Storage settings**, enable the S3 connection and generate S3 access keys.
3. In SavelyCLOUD, sign in and open **Connected storage** > **Add storage**.
4. Select **Supabase Storage**, then enter the project reference, bucket, region, access key ID, and secret access key shown by Supabase.
5. Optionally enter a folder prefix to keep SavelyCLOUD files under one virtual folder, then select **Connect storage**.

The project reference is the subdomain portion of your Supabase project URL. SavelyCLOUD builds the official direct Storage S3 endpoint as `https://PROJECT_REF.storage.supabase.co/storage/v1/s3`, signs requests on the server, and encrypts the access keys locally. Supabase documents that generated S3 keys are server-side credentials with access to every bucket and bypass Row Level Security, so do not paste them into browser code or share them with untrusted users. See [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication).

Use **Settings** on the Supabase connection card to change its name, project, region, bucket, or prefix. Leave the new key fields empty to keep the encrypted keys already saved.

## Share it on your local network

Bind the server to all network interfaces:

```powershell
$env:HOST="0.0.0.0"
npm start
```

Other devices on the same network can visit `http://YOUR-COMPUTER-IP:8787`. Windows Firewall may ask you to allow Node.js on private networks.

> This project serves HTTP. Do not expose it directly to the public internet. For internet access, put it behind a trusted HTTPS reverse proxy or a private mesh VPN such as Tailscale.

## Configuration

Set these environment variables before starting the server:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Listening interface. Use `0.0.0.0` for LAN access. |
| `PORT` | `8787` | Listening port. |
| `STORAGE_PATH` | `./storage` | Absolute or relative directory where files are stored. |
| `DATA_PATH` | `./.local-cloud-data` | Directory containing the local account database. |
| `MAX_FILE_SIZE` | `2GB` | Maximum size for one uploaded file. Supports B, KB, MB, GB, and TB. |
| `MAX_STORAGE` | `20GB` | Total storage quota. |
| `GOOGLE_CLIENT_ID` | empty | Google OAuth Web application client ID. |
| `GOOGLE_CLIENT_SECRET` | empty | Google OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | local callback URL | Must exactly match the authorized redirect URI in Google Cloud. |

Example with a separate disk:

```powershell
$env:STORAGE_PATH="D:\LocalCloud"
$env:MAX_STORAGE="500GB"
$env:MAX_FILE_SIZE="10GB"
$env:HOST="0.0.0.0"
npm start
```

## API

The browser interface uses a compact HTTP API. Account sessions are carried in secure HTTP-only, same-site cookies:

- `GET /health` — service health check
- `POST /api/auth/register` — create an account
- `POST /api/auth/login` — sign in
- `POST /api/auth/logout` — sign out
- `GET /api/auth/me` — return the current account
- `GET /api/status` — storage usage and limits
- `GET /api/files?path=folder` — list a folder
- `PUT /api/files?path=folder/file.txt` — upload a raw request body
- `GET /api/download?path=folder/file.txt` — download a file
- `POST /api/folders` with `{ "path": "folder/name" }` — create a folder
- `DELETE /api/items?path=folder/name` — recursively delete a file or folder
- `GET /api/connections` — list the signed-in account's linked services
- `GET /api/connections/google/start` — begin Google Drive OAuth authorization
- `GET /api/connections/google/callback` — validate OAuth state and save encrypted Google tokens
- `POST /api/connections` — validate and save a WebDAV or S3-compatible service
- `GET /api/connections/:id/files?path=folder` — list a connected folder
- `PUT /api/connections/:id/files?path=file` — upload to connected storage
- `GET /api/connections/:id/download?path=file` — download from connected storage
- `POST /api/connections/:id/folders` — create a connected folder
- `DELETE /api/connections/:id` — unlink a service without deleting its remote files
- `GET /api/admin/overview` — instance-wide counts and storage usage (admin only)
- `GET /api/admin/users` — user usage, quota, status, and connection counts (admin only)
- `PATCH /api/admin/users/:id` — change role, status, or storage quota (admin only)
- `GET /api/admin/users/:id/files` — browse a user's local files (admin only)
- `GET /api/admin/users/:id/download` — download a user's local file (admin only)
- `DELETE /api/admin/users/:id/files` — delete a user's local file or folder (admin only)
- `DELETE /api/admin/users/:id` — delete an account and its local files (admin only)

## Backups

Back up both the directories selected by `STORAGE_PATH` and `DATA_PATH`. The server does not replicate data automatically; a single local disk is not a backup. The data directory also contains `encryption.key`; losing it makes saved provider credentials unreadable.
