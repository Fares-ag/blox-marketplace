# TEMPORARY secrets vault

**Warning:** This folder contains live credentials committed for short-term team access only.

- Rotate every secret here before removing this folder.
- Delete `secrets/` and restore strict `.gitignore` before making the repo public.
- Never use GitHub secrets in production CI without masking.

## Files

| File | Copy to |
|------|---------|
| `api.env` | `packages/api/.env` |
| `root.env.local` | repo root `.env.local` (Vercel + Zoho backup) |
| `marketplace.env.local` | `packages/marketplace/.env.local` |
| `vite.env` | root `.env` + portal `.env` files |

Production Railway/Vercel secrets are **not** in this folder — pull those from each platform's dashboard.
