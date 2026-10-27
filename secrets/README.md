# Local secrets (not in git)

Credential files in this folder are **ignored by git**. Copy from your password manager or Railway/Vercel dashboards into the paths below.

| File | Copy to |
|------|---------|
| `api.env` | `packages/api/.env` |
| `root.env.local` | repo root `.env.local` (Vercel + Zoho backup) |
| `marketplace.env.local` | `packages/marketplace/.env.local` |
| `vite.env` | root `.env` + portal `.env` files |

Use `packages/api/.env.example` and each app’s `.env.example` for variable names only.

**If these files were ever pushed to GitHub:** treat every value that lived in `secrets/` as compromised and rotate it (Better Auth, DB, KYC, Zoho, SkipCash, Postmark, Vercel tokens, etc.). Removing files from the repo does not erase old commits.
