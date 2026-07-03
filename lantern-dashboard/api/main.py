import os
import csv
import io
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime

# Import database & sync helpers
try:
    from .database import (
        init_db, save_booking, get_all_bookings, get_daily_metrics_range,
        save_setting, get_setting, clear_bookings, get_first_booking_date
    )
except ImportError:
    from database import (
        init_db, save_booking, get_all_bookings, get_daily_metrics_range,
        save_setting, get_setting, clear_bookings, get_first_booking_date
    )

sync_data = None
sync_bookings_from_sheet = None

# Attempt to load marketing sync dependencies (which will fail in serverless environment)
try:
    try:
        from .sync_service import sync_data
    except ImportError:
        from sync_service import sync_data
except Exception as e:
    logger.warning(f"Sync service dependencies could not be loaded: {e}. API sync endpoints will be disabled.")

# Attempt to load Google Sheets sync dependencies (which will fail in serverless environment)
try:
    try:
        from .sheets_service import sync_bookings_from_sheet
    except ImportError:
        from sheets_service import sync_bookings_from_sheet
except Exception as e:
    logger.warning(f"Sheets service dependencies could not be loaded: {e}. Sheets sync endpoints will be disabled.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lantern Camp Analytics Dashboard API")

# Configurable CORS origins for production cross-domain fetching
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]

# If allow_origins contains wildcard "*", we must set allow_credentials to False
# because browsers reject "*" with credentials allowed.
allow_creds = True
if "*" in allowed_origins:
    allow_creds = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()
    logger.info("FastAPI Server Started & SQLite Database Initialized.")

# Pydantic models for request bodies
class BookingWebhook(BaseModel):
    id: str
    channel: str
    booking_date: str  # YYYY-MM-DD
    nights: int
    gross_revenue: float
    ota_fee_percent: Optional[float] = 0.0
    guest_email: Optional[str] = None

class SettingsUpdate(BaseModel):
    newsletter_subscribers: int
    mews_sheet_id: Optional[str] = ""

class SheetsSyncPayload(BaseModel):
    spreadsheet_id: str
    range_name: Optional[str] = "Sheet1!A1:Z5000"

# --- API ENDPOINTS ---

@app.get("/api/dashboard/overview")
def get_overview_data(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Calculates KPI cards and trend line data."""
    bookings = get_all_bookings()
    metrics = get_daily_metrics_range(start_date, end_date)
    
    # Filter bookings by date range if provided
    if start_date or end_date:
        filtered_bookings = []
        for b in bookings:
            b_date = b['booking_date']
            if start_date and b_date < start_date:
                continue
            if end_date and b_date > end_date:
                continue
            filtered_bookings.append(b)
        bookings = filtered_bookings
        
    # Calculate revenue KPIs
    total_net_rev = sum(b['net_revenue'] for b in bookings)
    total_bookings = len(bookings)
    
    # Calculate marketing spend KPIs
    total_google_spend = sum(m['google_spend'] for m in metrics)
    total_meta_spend = sum(m['meta_spend'] for m in metrics)
    total_spend = total_google_spend + total_meta_spend
    
    # ROAS
    roas = total_net_rev / total_spend if total_spend > 0 else 0.0
    
    # Newsletter signups
    newsletter_subs = int(get_setting("newsletter_subscribers", "0"))
    
    # Web Traffic
    total_sessions = sum(m['sessions'] for m in metrics)
    conv_rate = (total_bookings / total_sessions * 100.0) if total_sessions > 0 else 0.0
    
    # Construct trend chart data (grouped by date)
    trend_dict = {}
    
    # Feed ad spend by date
    for m in metrics:
        d = m['date']
        trend_dict[d] = {
            "date": d,
            "spend": m['google_spend'] + m['meta_spend'],
            "revenue": 0.0,
            "sessions": m['sessions']
        }
        
    # Feed booking revenue by date
    for b in bookings:
        d = b['booking_date']
        if d not in trend_dict:
            trend_dict[d] = {"date": d, "spend": 0.0, "revenue": 0.0, "sessions": 0}
        trend_dict[d]["revenue"] += b['net_revenue']
        
    # Format trend to sorted list
    trend_data = [trend_dict[k] for k in sorted(trend_dict.keys())]
    
    return {
        "kpis": {
            "total_net_revenue": round(total_net_rev, 2),
            "total_bookings": total_bookings,
            "total_spend": round(total_spend, 2),
            "roas": round(roas, 2),
            "newsletter_subscribers": newsletter_subs,
            "total_sessions": total_sessions,
            "conversion_rate": round(conv_rate, 2)
        },
        "trend_chart": trend_data,
        "last_synced": get_setting("last_synced_at", "Never")
    }

@app.get("/api/dashboard/ads")
def get_ads_data(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Returns Google and Meta advertising performance metrics."""
    metrics = get_daily_metrics_range(start_date, end_date)
    
    google_spend = sum(m['google_spend'] for m in metrics)
    google_impr = sum(m['google_impressions'] for m in metrics)
    google_clicks = sum(m['google_clicks'] for m in metrics)
    
    meta_spend = sum(m['meta_spend'] for m in metrics)
    meta_impr = sum(m['meta_impressions'] for m in metrics)
    meta_views = sum(m['meta_views'] for m in metrics)
    meta_clicks = sum(m['meta_clicks'] for m in metrics)
    
    # Calculate rates
    google_ctr = (google_clicks / google_impr * 100.0) if google_impr > 0 else 0.0
    google_cpc = (google_spend / google_clicks) if google_clicks > 0 else 0.0
    
    meta_ctr = (meta_clicks / meta_impr * 100.0) if meta_impr > 0 else 0.0
    meta_cpv = (meta_spend / meta_views) if meta_views > 0 else 0.0
    meta_cpc = (meta_spend / meta_clicks) if meta_clicks > 0 else 0.0
    
    return {
        "channels": [
            {
                "name": "Google Ads",
                "spend": round(google_spend, 2),
                "impressions": google_impr,
                "clicks": google_clicks,
                "ctr": round(google_ctr, 2),
                "cpc": round(google_cpc, 2),
                "cpv_label": "CPC",
                "cpv": round(google_cpc, 2)
            },
            {
                "name": "Meta Ads",
                "spend": round(meta_spend, 2),
                "impressions": meta_impr,
                "clicks": meta_clicks,
                "ctr": round(meta_ctr, 2),
                "cpc": round(meta_cpc, 2),
                "cpv_label": "CPV (LP Views)",
                "cpv": round(meta_cpv, 2)
            }
        ],
        "daily_breakdown": [
            {
                "date": m['date'],
                "google_spend": round(m['google_spend'], 2),
                "google_clicks": m['google_clicks'],
                "meta_spend": round(m['meta_spend'], 2),
                "meta_clicks": m['meta_clicks'],
                "meta_views": m['meta_views']
            } for m in metrics
        ]
    }

@app.get("/api/dashboard/traffic")
def get_traffic_data(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Returns website traffic statistics and funnel metrics."""
    metrics = get_daily_metrics_range(start_date, end_date)
    bookings = get_all_bookings()
    
    # Filter bookings inside dates
    if start_date or end_date:
        filtered_bookings = []
        for b in bookings:
            b_date = b['booking_date']
            if start_date and b_date < start_date:
                continue
            if end_date and b_date > end_date:
                continue
            filtered_bookings.append(b)
        bookings = filtered_bookings
        
    total_sessions = sum(m['sessions'] for m in metrics)
    total_pageviews = sum(m['pageviews'] for m in metrics)
    total_checkouts = sum(m['checkouts_initiated'] for m in metrics)
    
    # Count direct purchases in our system as a proxy for GA4 funnel
    direct_purchases = len([b for b in bookings if b['channel'].lower() == 'direct'])
    total_purchases = len(bookings)  # All bookings
    
    return {
        "summary": {
            "sessions": total_sessions,
            "pageviews": total_pageviews,
            "checkouts_initiated": total_checkouts
        },
        "funnel": {
            "sessions": total_sessions,
            "checkouts": total_checkouts,
            "purchases": total_purchases,  # Total bookings
            "direct_purchases": direct_purchases,
            "checkout_conv_rate": round((total_checkouts / total_sessions * 100.0), 2) if total_sessions > 0 else 0.0,
            "booking_conv_rate": round((total_purchases / total_sessions * 100.0), 2) if total_sessions > 0 else 0.0
        },
        "daily_traffic": [
            {
                "date": m['date'],
                "sessions": m['sessions'],
                "pageviews": m['pageviews'],
                "checkouts": m['checkouts_initiated']
            } for m in metrics
        ]
    }

@app.get("/api/dashboard/bookings")
def get_bookings_ledger():
    """Returns booking records and channels aggregate statistics."""
    bookings = get_all_bookings()
    
    # Group by channel
    channels_dict = {}
    for b in bookings:
        ch = b['channel']
        if ch not in channels_dict:
            channels_dict[ch] = {"name": ch, "count": 0, "gross": 0.0, "net": 0.0}
        channels_dict[ch]["count"] += 1
        channels_dict[ch]["gross"] += b['gross_revenue']
        channels_dict[ch]["net"] += b['net_revenue']
        
    return {
        "bookings": bookings,
        "channel_summary": list(channels_dict.values())
    }

# --- DATA INGEST & MUTATION ---

@app.post("/api/webhooks/booking")
def webhook_booking(booking: BookingWebhook):
    """Zapier webhook endpoint. Real-time insertion from Mews."""
    try:
        net = save_booking(
            booking_id=booking.id,
            channel=booking.channel,
            booking_date=booking.booking_date,
            nights=booking.nights,
            gross_revenue=booking.gross_revenue,
            ota_fee_percent=booking.ota_fee_percent or 0.0,
            guest_email=booking.guest_email
        )
        logger.info(f"Webhook insertion success: {booking.id} ({booking.channel}) - Net: ${net}")
        return {"status": "success", "id": booking.id, "net_revenue": round(net, 2)}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/data/upload-csv")
async def upload_bookings_csv(file: UploadFile = File(...)):
    """Parses and imports bookings from a Mews Reservations CSV."""
    contents = await file.read()
    decoded = contents.decode("utf-8")
    csv_file = io.StringIO(decoded)
    
    # Read CSV
    reader = csv.reader(csv_file)
    header = next(reader, None)
    
    if not header:
        raise HTTPException(status_code=400, detail="Empty CSV file")
        
    # Map headers dynamically (case-insensitive)
    header_map = {}
    for idx, col in enumerate(header):
        col_clean = col.strip().lower()
        header_map[col_clean] = idx
        
    # Helper to find index of possible column names
    def find_col_idx(aliases):
        for alias in aliases:
            if alias in header_map:
                return header_map[alias]
        return None
        
    # Standard field mapping
    id_idx = find_col_idx(["id", "reservation number", "confirmation number", "number", "reservation id"])
    channel_idx = find_col_idx(["channel", "source", "reservation source", "origin", "type"])
    date_idx = find_col_idx(["date", "booking date", "booking_date", "created", "start", "start date", "arrival"])
    nights_idx = find_col_idx(["nights", "duration", "nights count"])
    gross_idx = find_col_idx(["gross revenue", "gross_revenue", "revenue", "gross value", "price", "amount"])
    fee_idx = find_col_idx(["ota fee %", "ota fee percent", "fee %", "ota fee"])
    email_idx = find_col_idx(["guest email", "guest_email", "email", "reservation owner email"])
    
    if None in (id_idx, channel_idx, date_idx, nights_idx, gross_idx):
        raise HTTPException(
            status_code=400,
            detail="CSV missing required headers. Must include: ID/Reservation Number, Channel/Source, Date/Arrival, Nights/Duration, Gross Revenue/Price."
        )
        
    count = 0
    errors = []
    
    for row_idx, row in enumerate(reader):
        if not row or len(row) <= max(id_idx, channel_idx, date_idx, nights_idx, gross_idx):
            continue
            
        try:
            booking_id = row[id_idx].strip()
            if not booking_id:
                continue
                
            channel = row[channel_idx].strip()
            
            # Date cleaning (parse standard formats)
            date_raw = row[date_idx].strip()
            # Try parsing multiple common date formats
            booking_date = None
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%m/%d/%y"):
                try:
                    dt = datetime.strptime(date_raw.split(" ")[0], fmt)
                    booking_date = dt.strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
            
            if not booking_date:
                raise ValueError(f"Could not parse date: {date_raw}")
                
            nights = int(float(row[nights_idx].strip()))
            
            # Clean revenue numeric strings (remove $, commas, etc.)
            gross_str = row[gross_idx].replace("$", "").replace(",", "").strip()
            gross_revenue = float(gross_str)
            
            # OTA Fee
            ota_fee = 0.0
            if fee_idx is not None and len(row) > fee_idx:
                fee_str = row[fee_idx].replace("%", "").strip()
                ota_fee = float(fee_str) if fee_str else 0.0
                
            # Auto-default fees based on channel name if fee is 0.0 or not provided
            if ota_fee == 0.0:
                ch_lower = channel.lower()
                if "airbnb" in ch_lower:
                    ota_fee = 15.0
                elif "booking" in ch_lower:
                    ota_fee = 17.0
                
            # Guest Email
            guest_email = None
            if email_idx is not None and len(row) > email_idx:
                guest_email = row[email_idx].strip()
                
            save_booking(
                booking_id=booking_id,
                channel=channel,
                booking_date=booking_date,
                nights=nights,
                gross_revenue=gross_revenue,
                ota_fee_percent=ota_fee,
                guest_email=guest_email
            )
            count += 1
        except Exception as err:
            errors.append(f"Row {row_idx + 2}: {err}")
            
    return {"status": "success", "imported_rows": count, "errors": errors}

@app.post("/api/data/sync")
def trigger_sync(background_tasks: BackgroundTasks, days: int = 30):
    """Triggers dynamic marketing API sync in a background thread."""
    if sync_data is None:
        raise HTTPException(
            status_code=501,
            detail="Marketing API sync is not supported in the serverless environment. Please run the sync script locally."
        )
    background_tasks.add_task(sync_data, days=days)
    return {"status": "sync_started", "message": f"Sync task scheduled in background for the last {days} days."}

@app.post("/api/settings")
def update_settings(payload: SettingsUpdate):
    """Updates newsletter subscribers and manual metrics."""
    save_setting("newsletter_subscribers", str(payload.newsletter_subscribers))
    save_setting("mews_sheet_id", payload.mews_sheet_id or "")
    return {
        "status": "success", 
        "newsletter_subscribers": payload.newsletter_subscribers,
        "mews_sheet_id": payload.mews_sheet_id
    }

@app.get("/api/settings")
def get_settings():
    """Retrieves all backend settings."""
    newsletter = int(get_setting("newsletter_subscribers", "0"))
    last_synced = get_setting("last_synced_at", "Never")
    sheet_id = get_setting("mews_sheet_id", "")
    return {
        "newsletter_subscribers": newsletter,
        "last_synced_at": last_synced,
        "mews_sheet_id": sheet_id
    }

@app.post("/api/data/sync-sheets")
def trigger_sheets_sync(payload: SheetsSyncPayload):
    """Triggers synchronizing bookings from the specified Google Sheet."""
    if sync_bookings_from_sheet is None:
        raise HTTPException(
            status_code=501,
            detail="Google Sheets sync is not supported in the serverless environment. Please run the sync script locally."
        )
    try:
        count, errors = sync_bookings_from_sheet(payload.spreadsheet_id, payload.range_name)
        return {"status": "success", "imported_rows": count, "errors": errors}
    except Exception as e:
        logger.error(f"Error syncing from Google Sheets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/data/first-booking-date")
def api_get_first_booking_date():
    """Returns the date of the oldest booking in the system, or None."""
    date_str = get_first_booking_date()
    return {"first_booking_date": date_str}

@app.post("/api/data/clear-bookings")
def api_clear_bookings():
    """Deletes all bookings from the database. (Useful for reset)."""
    clear_bookings()
    return {"status": "success", "message": "All bookings deleted."}

# Serve static files from the React frontend build directory if it exists
frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        if catchall.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Frontend index.html not found")

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host=host, port=port)
