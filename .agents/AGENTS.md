# Agent Instructions: Lantern Camp Analytics Workspace

You are pairing with the user to manage the Lantern Camp Marketing and Booking Analytics Dashboard. Follow these workspace-specific operational patterns:

## 1. Automated Dashboard Refresh Trigger
If the user asks to **"refresh lantern dashboard"**, **"update data"**, **"sync metrics"**, or any equivalent phrase:
1.  **Do not ask for confirmation or explain how to run it.**
2.  Immediately invoke the `run_command` tool from the workspace root directory:
    *   **Cwd:** `/Users/swardy/Documents/Antigravity Projects/Lantern Advertising`
    *   **Command:** `.venv/bin/python lantern-dashboard/api/local_sync.py`
3.  Explain that you are running the master sync script in the background to update the GA4, Google Ads, and Meta Ads databases (note: bookings are updated directly from Mews reports/CSV imports, and Google Sheets is no longer used in the sync process).
4.  Once the background task completes, inform the user to refresh their live dashboard at `https://lantern-analytics.vercel.app`.

## 2. Technical Stack Reference
*   **Root Folder (`lantern-dashboard/`):** React frontend built via Vite.
*   **Backend (`lantern-dashboard/api/`):** Python FastAPI serverless function deployed at `/api/index.py` using `vercel.json` explicit builds.
*   **Database (Neon PostgreSQL):** Cloud database shared connection string is stored in the local `.env` file (`DATABASE_URL`). Template:
    `postgresql://neondb_owner:[PASSWORD_REDACTED]@ep-ancient-pine-atwfrg68.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require`
*   **Vercel Configuration:** Main configuration in `lantern-dashboard/vercel.json`.
*   **Credential Files (Local):** `ga4-credentials.json`, `google-ads.yaml`, `meta-credentials.json` are stored in the root folder.

## 3. Custom Dashboard Reference (Lantern Analytics)
*   **No Looker Studio:** The project does **NOT** use Looker Studio. Do not suggest or mention it. All historical planning mentions are obsolete.
*   **Application Name:** The dashboard is a custom web application called **Lantern Analytics** hosted at `https://lantern-analytics.vercel.app`.

