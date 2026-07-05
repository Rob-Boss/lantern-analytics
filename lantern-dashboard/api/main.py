import os
import csv
import io
import logging
import requests
from typing import Optional
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import database & sync helpers
try:
    from .database import (
        init_db, save_booking, get_all_bookings, get_daily_metrics_range,
        save_setting, get_setting, clear_bookings, get_first_booking_date,
        get_geo_metrics
    )
except ImportError:
    from database import (
        init_db, save_booking, get_all_bookings, get_daily_metrics_range,
        save_setting, get_setting, clear_bookings, get_first_booking_date,
        get_geo_metrics
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

app = FastAPI(title="Lantern Camp Analytics Dashboard API")

def normalize_channel(ch: str) -> str:
    if not ch:
        return "Mews Booking Engine"
    ch_lower = ch.lower()
    if "airbnb" in ch_lower or "abb" in ch_lower:
        return "Airbnb"
    if "booking.com" in ch_lower or "bcom" in ch_lower or "bdc" in ch_lower:
        return "Booking.com"
    if "booking engine" in ch_lower or "mews" in ch_lower or "direct" in ch_lower or "distributor" in ch_lower:
        return "Mews Booking Engine"
    return "Other"

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
    nights: Optional[int] = None
    gross_revenue: Optional[float] = None
    ota_fee_percent: Optional[float] = 0.0
    guest_email: Optional[str] = None

class SettingsUpdate(BaseModel):
    newsletter_subscribers: int
    mews_sheet_id: Optional[str] = ""

class SheetsSyncPayload(BaseModel):
    spreadsheet_id: str
    range_name: Optional[str] = "Sheet1!A1:Z5000"

# --- MEWS API REAL-TIME SYNC HELPER ---

MEWS_API_URL = os.getenv("MEWS_API_URL", "https://api.mews.com")
MEWS_CLIENT_TOKEN = os.getenv("MEWS_CLIENT_TOKEN")
MEWS_ACCESS_TOKEN = os.getenv("MEWS_ACCESS_TOKEN")
MEWS_CLIENT_NAME = os.getenv("MEWS_CLIENT_NAME", "Lantern Camp Dashboard")

def fetch_booking_details_from_mews(booking_id: str) -> dict:
    """Queries Mews API in real-time to fetch reservation details, email, and revenue."""
    if not MEWS_CLIENT_TOKEN or not MEWS_ACCESS_TOKEN:
        raise ValueError("Mews API credentials not configured in environment variables")
        
    headers = {"Content-Type": "application/json"}
    
    # 1. Fetch Reservation details
    res_payload = {
        "ClientToken": MEWS_CLIENT_TOKEN,
        "AccessToken": MEWS_ACCESS_TOKEN,
        "Client": MEWS_CLIENT_NAME
    }
    # Check if booking_id is a UUID or a confirmation number (digit)
    is_uuid = len(booking_id) > 10 and "-" in booking_id
    if is_uuid:
        res_payload["ReservationIds"] = [booking_id]
    else:
        res_payload["Numbers"] = [str(booking_id)]
        
    logger.info(f"Mews API: Fetching reservation {booking_id} from {MEWS_API_URL}")
    res_resp = requests.post(f"{MEWS_API_URL}/api/connector/v1/reservations/getAll/2023-06-06", json=res_payload, headers=headers)
    res_resp.raise_for_status()
    res_data = res_resp.json()
    
    reservations = res_data.get("Reservations", [])
    if not reservations:
        raise ValueError(f"Reservation {booking_id} not found in Mews")
    res = reservations[0]
    
    # Gather reservation fields
    number = res.get("Number")
    channel = res.get("Origin") or ""
    created_utc = res.get("CreatedUtc")
    booking_date = created_utc.split("T")[0] if created_utc else datetime.utcnow().strftime("%Y-%m-%d")
    
    # Calculate nights from stay dates
    start_utc = res.get("StartUtc")
    end_utc = res.get("EndUtc")
    nights = 1
    if start_utc and end_utc:
        try:
            start_dt = datetime.fromisoformat(start_utc.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end_utc.replace("Z", "+00:00"))
            nights = max(1, (end_dt - start_dt).days)
        except Exception as e:
            logger.warning(f"Error calculating nights: {e}")
            
    customer_id = res.get("CustomerId")
    res_uuid = res.get("Id")
    
    # 2. Fetch Customer profile (for Email)
    guest_email = None
    if customer_id:
        cust_payload = {
            "ClientToken": MEWS_CLIENT_TOKEN,
            "AccessToken": MEWS_ACCESS_TOKEN,
            "Client": MEWS_CLIENT_NAME,
            "CustomerIds": [customer_id]
        }
        try:
            cust_resp = requests.post(f"{MEWS_API_URL}/api/connector/v1/customers/getAll/2023-06-06", json=cust_payload, headers=headers)
            if cust_resp.status_code == 200:
                cust_data = cust_resp.json()
                customers = cust_data.get("Customers", [])
                if customers:
                    guest_email = customers[0].get("Email")
        except Exception as e:
            logger.warning(f"Error fetching customer email: {e}")
            
    # 3. Fetch Order Items (for total Gross Revenue)
    gross_revenue = 0.0
    if res_uuid:
        order_payload = {
            "ClientToken": MEWS_CLIENT_TOKEN,
            "AccessToken": MEWS_ACCESS_TOKEN,
            "Client": MEWS_CLIENT_NAME,
            "ReservationIds": [res_uuid]
        }
        try:
            order_resp = requests.post(f"{MEWS_API_URL}/api/connector/v1/orderItems/getAll/2023-06-06", json=order_payload, headers=headers)
            if order_resp.status_code == 200:
                order_data = order_resp.json()
                # Sum the value of all order items that are not canceled
                for item in order_data.get("OrderItems", []):
                    if item.get("State") != "Canceled":
                        amount_obj = item.get("Amount") or {}
                        val = amount_obj.get("Value") or 0.0
                        gross_revenue += float(val)
        except Exception as e:
            logger.warning(f"Error fetching order items: {e}")
            
    return {
        "id": number,
        "channel": channel,
        "booking_date": booking_date,
        "nights": nights,
        "gross_revenue": round(gross_revenue, 2),
        "guest_email": guest_email
    }

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
    airbnb_net_rev = sum(b['net_revenue'] for b in bookings if normalize_channel(b['channel']) == 'Airbnb')
    mews_net_rev = sum(b['net_revenue'] for b in bookings if normalize_channel(b['channel']) == 'Mews Booking Engine')
    total_bookings = len(bookings)
    
    # Calculate marketing spend KPIs
    total_google_spend = sum(m['google_spend'] for m in metrics)
    total_meta_spend = sum(m['meta_spend'] for m in metrics)
    total_spend = total_google_spend + total_meta_spend
    
    # ROAS (Only include direct booking engine bookings, excluding Airbnb)
    roas = mews_net_rev / total_spend if total_spend > 0 else 0.0
    
    # Newsletter signups
    newsletter_subs = int(get_setting("newsletter_subscribers", "0"))
    
    # Web Traffic & Impressions
    total_sessions = sum(m['sessions'] for m in metrics)
    conv_rate = (total_bookings / total_sessions * 100.0) if total_sessions > 0 else 0.0
    
    total_google_impressions = sum(m['google_impressions'] for m in metrics)
    total_meta_impressions = sum(m['meta_impressions'] for m in metrics)
    total_impressions = total_google_impressions + total_meta_impressions
    
    # Calculate 7-day moving average of Meta & Google cost per view combined
    sorted_metrics = sorted(metrics, key=lambda x: x['date'])
    last_7_metrics = sorted_metrics[-7:] if len(sorted_metrics) >= 7 else sorted_metrics
    last_7_combined_spend = sum(m['google_spend'] + m['meta_spend'] for m in last_7_metrics)
    last_7_combined_views = sum(m['google_clicks'] + m['meta_views'] for m in last_7_metrics)
    cost_per_view_7d = last_7_combined_spend / last_7_combined_views if last_7_combined_views > 0 else 0.0
    
    last_7_sessions = sum(m['sessions'] for m in last_7_metrics)
    daily_sessions_7d = last_7_sessions / len(last_7_metrics) if last_7_metrics else 0.0
    
    last_7_checkouts = sum(m['checkouts_initiated'] for m in last_7_metrics)
    checkout_rate_7d = (last_7_checkouts / last_7_sessions * 100.0) if last_7_sessions > 0 else 0.0
    
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
        
    # Format trend to sorted list, starting graphs on June 1st
    trend_data = [trend_dict[k] for k in sorted(trend_dict.keys()) if k >= "2026-06-01"]
    
    # Calculate channel summary (normalized)
    channels_dict = {}
    for b in bookings:
        ch = normalize_channel(b['channel'])
        if ch not in channels_dict:
            channels_dict[ch] = {"name": ch, "count": 0, "gross": 0.0, "net": 0.0}
        channels_dict[ch]["count"] += 1
        channels_dict[ch]["gross"] += b['gross_revenue']
        channels_dict[ch]["net"] += b['net_revenue']
        
    # channel_summary
    channel_summary = list(channels_dict.values())
    
    return {
        "kpis": {
            "total_net_revenue": round(total_net_rev, 2),
            "airbnb_net_revenue": round(airbnb_net_rev, 2),
            "mews_net_revenue": round(mews_net_rev, 2),
            "total_bookings": total_bookings,
            "total_spend": round(total_spend, 2),
            "google_spend": round(total_google_spend, 2),
            "meta_spend": round(total_meta_spend, 2),
            "roas": round(roas, 2),
            "newsletter_subscribers": newsletter_subs,
            "total_sessions": total_sessions,
            "conversion_rate": round(conv_rate, 2),
            "total_impressions": total_impressions,
            "cost_per_view_7d": round(cost_per_view_7d, 4),
            "daily_sessions_7d": round(daily_sessions_7d, 1),
            "checkout_rate_7d": round(checkout_rate_7d, 2)
        },
        "trend_chart": trend_data,
        "channel_summary": channel_summary,
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
            } for m in metrics if m['date'] >= "2026-06-01"
        ]
    }

@app.get("/api/dashboard/traffic")
def get_traffic_data(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Returns website traffic statistics, funnel metrics, and period-over-period comparisons."""
    # Ensure dates are provided
    if not start_date or not end_date:
        from datetime import date as py_date, timedelta
        today = py_date.today()
        start_date = (today - timedelta(days=29)).strftime("%Y-%m-%d")
        end_date = today.strftime("%Y-%m-%d")
        
    try:
        from datetime import datetime, timedelta
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        
        # Calculate length of the selected range in days
        period_days = (end_dt - start_dt).days + 1
        
        # Calculate dates for previous period
        prev_start_dt = start_dt - timedelta(days=period_days)
        prev_end_dt = start_dt - timedelta(days=1)
        
        prev_start_date = prev_start_dt.strftime("%Y-%m-%d")
        prev_end_date = prev_end_dt.strftime("%Y-%m-%d")
    except Exception:
        # Fallback if parsing fails
        prev_start_date = start_date
        prev_end_date = end_date
        
    metrics_current = get_daily_metrics_range(start_date, end_date)
    metrics_previous = get_daily_metrics_range(prev_start_date, prev_end_date)
    bookings = get_all_bookings()
    
    # Filter bookings inside dates
    filtered_bookings = []
    for b in bookings:
        b_date = b['booking_date']
        if start_date <= b_date <= end_date:
            filtered_bookings.append(b)
            
    # Calculate current aggregates
    total_sessions = sum(m.get('sessions', 0) for m in metrics_current)
    total_pageviews = sum(m.get('pageviews', 0) for m in metrics_current)
    total_checkouts = sum(m.get('checkouts_initiated', 0) for m in metrics_current)
    total_new_users = sum(m.get('new_users', 0) for m in metrics_current)
    total_active_users = sum(m.get('active_users', 0) for m in metrics_current)
    total_returning_users = max(0, total_active_users - total_new_users)
    
    # Calculate previous aggregates for comparison
    prev_sessions = sum(m.get('sessions', 0) for m in metrics_previous)
    prev_pageviews = sum(m.get('pageviews', 0) for m in metrics_previous)
    prev_checkouts = sum(m.get('checkouts_initiated', 0) for m in metrics_previous)
    prev_new_users = sum(m.get('new_users', 0) for m in metrics_previous)
    prev_active_users = sum(m.get('active_users', 0) for m in metrics_previous)
    prev_returning_users = max(0, prev_active_users - prev_new_users)
    
    # Calculate conversion rates, adjusting for the checkout tracking start date (2026-07-02)
    checkout_active_sessions = sum(m.get('sessions', 0) for m in metrics_current if m['date'] >= '2026-07-02')
    checkout_active_bookings = len([b for b in filtered_bookings if b['booking_date'] >= '2026-07-02' and b['channel'].lower() == 'direct'])
    
    checkout_conv_rate = round((total_checkouts / checkout_active_sessions * 100.0), 2) if checkout_active_sessions > 0 else 0.0
    checkout_to_booking_rate = round((checkout_active_bookings / total_checkouts * 100.0), 2) if total_checkouts > 0 else 0.0
    
    # Count direct purchases in our system as a proxy for GA4 funnel
    direct_purchases = len([b for b in filtered_bookings if b['channel'].lower() == 'direct'])
    total_purchases = len(filtered_bookings)
    
    # Pre-align current and previous daily traffic arrays by exact day offset
    # This guarantees they both have the same length and align by index perfectly,
    # mapping date C_date to P_date = C_date - period_days, defaulting missing days to 0.
    metrics_map = {m['date']: m for m in get_daily_metrics_range(prev_start_date, end_date)}
    
    daily_traffic = []
    previous_daily_traffic = []
    
    for m in metrics_current:
        c_date = m['date']
        if c_date < "2026-06-01":
            continue
        try:
            c_dt = datetime.strptime(c_date, "%Y-%m-%d").date()
            p_dt = c_dt - timedelta(days=period_days)
            p_date = p_dt.strftime("%Y-%m-%d")
        except Exception:
            p_date = c_date
            
        daily_traffic.append({
            "date": c_date,
            "sessions": m.get('sessions', 0),
            "pageviews": m.get('pageviews', 0),
            "checkouts": m.get('checkouts_initiated', 0),
            "new_users": m.get('new_users', 0),
            "active_users": m.get('active_users', 0),
            "returning_users": max(0, m.get('active_users', 0) - m.get('new_users', 0))
        })
        
        pm = metrics_map.get(p_date, {})
        previous_daily_traffic.append({
            "date": p_date,
            "sessions": pm.get('sessions', 0),
            "pageviews": pm.get('pageviews', 0),
            "checkouts": pm.get('checkouts_initiated', 0),
            "new_users": pm.get('new_users', 0),
            "active_users": pm.get('active_users', 0),
            "returning_users": max(0, pm.get('active_users', 0) - pm.get('new_users', 0))
        })
        
    # Fetch cached Geographic metrics from the database
    geo_regions = []
    geo_cities = []
    try:
        geo_regions = get_geo_metrics(start_date, end_date, "region", limit=10)
        geo_cities = get_geo_metrics(start_date, end_date, "city", limit=10)
    except Exception as e:
        logger.error(f"Failed to fetch cached geo metrics: {e}")

    return {
        "summary": {
            "sessions": total_sessions,
            "pageviews": total_pageviews,
            "checkouts_initiated": total_checkouts,
            "new_users": total_new_users,
            "returning_users": total_returning_users,
            "active_users": total_active_users
        },
        "previous_summary": {
            "sessions": prev_sessions,
            "pageviews": prev_pageviews,
            "checkouts_initiated": prev_checkouts,
            "new_users": prev_new_users,
            "returning_users": prev_returning_users,
            "active_users": prev_active_users
        },
        "funnel": {
            "sessions": total_sessions,
            "checkouts": total_checkouts,
            "purchases": total_purchases,
            "direct_purchases": direct_purchases,
            "checkout_conv_rate": checkout_conv_rate,
            "checkout_to_booking_rate": checkout_to_booking_rate,
            "booking_conv_rate": round((total_purchases / total_sessions * 100.0), 2) if total_sessions > 0 else 0.0
        },
        "daily_traffic": daily_traffic,
        "previous_daily_traffic": previous_daily_traffic,
        "geo_regions": geo_regions,
        "geo_cities": geo_cities
    }

@app.get("/api/dashboard/bookings")
def get_bookings_ledger(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Returns booking records and channels aggregate statistics."""
    bookings = get_all_bookings()
    
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
        
    # Group by normalized channel and attach to bookings
    channels_dict = {}
    for b in bookings:
        ch_raw = b['channel']
        ch = normalize_channel(ch_raw)
        b['normalized_channel'] = ch
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
        # Check if we need to query Mews directly to resolve missing fields
        if booking.nights is None or booking.gross_revenue is None:
            try:
                logger.info(f"Triggering Mews API lookup for booking ID: {booking.id}")
                resolved = fetch_booking_details_from_mews(booking.id)
                booking.nights = resolved["nights"]
                booking.gross_revenue = resolved["gross_revenue"]
                if resolved["guest_email"]:
                    booking.guest_email = resolved["guest_email"]
                if resolved["channel"]:
                    booking.channel = resolved["channel"]
            except Exception as lookup_err:
                logger.error(f"Failed to resolve Mews details for {booking.id}: {lookup_err}")
                return {"status": "skipped", "id": booking.id, "message": f"Could not resolve Mews details: {lookup_err}"}
                
        ota_fee = booking.ota_fee_percent or 0.0
        if ota_fee == 0.0 and booking.channel:
            ch_lower = booking.channel.lower()
            if "airbnb" in ch_lower or "abb" in ch_lower:
                ota_fee = 15.0
            elif ("booking" in ch_lower and "booking engine" not in ch_lower) or "bcom" in ch_lower or "bdc" in ch_lower:
                ota_fee = 17.0
                
        net = save_booking(
            booking_id=booking.id,
            channel=booking.channel,
            booking_date=booking.booking_date,
            nights=booking.nights,
            gross_revenue=booking.gross_revenue,
            ota_fee_percent=ota_fee,
            guest_email=booking.guest_email
        )
        logger.info(f"Webhook insertion success: {booking.id} ({booking.channel}) - Net: ${net}")
        return {"status": "success", "id": booking.id, "net_revenue": round(net, 2)}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/webhooks/mews-report")
def webhook_mews_report(payload: dict):
    """Webhook endpoint for Mews scheduled Reservations Report exports."""
    try:
        documents = payload.get("Documents", [])
        reservations_doc = None
        for doc in documents:
            if doc.get("Name") == "Reservations":
                reservations_doc = doc
                break
                
        if not reservations_doc:
            logger.warning("No Reservations document found in Mews report webhook payload")
            return {"status": "skipped", "message": "No Reservations document found"}
            
        data = reservations_doc.get("Data", [])
        if len(data) < 2:
            logger.info("Empty Reservations document in Mews report")
            return {"status": "skipped", "message": "Reservations document is empty"}
            
        headers = data[0]
        rows = data[1:]
        
        # Check required headers
        required_headers = ['Number', 'Origin', 'Created', 'Count (hours)', 'Count (nights)', 'Total amount', 'Email']
        for h in required_headers:
            if h not in headers:
                logger.error(f"Missing required header '{h}' in Mews report webhook payload")
                raise HTTPException(status_code=400, detail=f"Missing required header '{h}'")
                
        # Find column indices
        number_idx = headers.index('Number')
        origin_idx = headers.index('Origin')
        created_idx = headers.index('Created')
        hours_idx = headers.index('Count (hours)')
        nights_idx = headers.index('Count (nights)')
        amount_idx = headers.index('Total amount')
        email_idx = headers.index('Email')
        travel_agency_idx = headers.index('Travel agency') if 'Travel agency' in headers else -1
        source_idx = headers.index('Reservation source') if 'Reservation source' in headers else -1
        
        imported_count = 0
        
        for row in rows:
            if not row or len(row) <= number_idx:
                continue
            booking_id = row[number_idx]
            if not booking_id or booking_id == 'Total':
                continue
                
            raw_origin = row[origin_idx]
            if not raw_origin and travel_agency_idx != -1 and len(row) > travel_agency_idx:
                raw_origin = row[travel_agency_idx]
            if not raw_origin and source_idx != -1 and len(row) > source_idx:
                raw_origin = row[source_idx]
            raw_origin = raw_origin or ''
            
            channel = normalize_channel(raw_origin)
            
            # Date format parsing
            raw_date = row[created_idx] or ''
            booking_date = raw_date.split('T')[0] if 'T' in raw_date else raw_date
            
            # Nights calculation (Stays use 'Count (hours)' in the report, Sauna uses 'Count (nights)')
            c_hours = row[hours_idx] if len(row) > hours_idx else None
            c_nights = row[nights_idx] if len(row) > nights_idx else None
            nights = 0
            if c_hours is not None:
                try:
                    nights = int(c_hours)
                except (ValueError, TypeError):
                    pass
            elif c_nights is not None:
                try:
                    nights = int(c_nights)
                except (ValueError, TypeError):
                    pass
                    
            # Gross revenue
            raw_amount = row[amount_idx] if len(row) > amount_idx else None
            gross_revenue = 0.0
            if raw_amount is not None:
                try:
                    gross_revenue = float(raw_amount)
                except (ValueError, TypeError):
                    pass
                    
            # Guest Email
            guest_email = row[email_idx] if (email_idx != -1 and len(row) > email_idx) else None
            
            # Calculate OTA fee
            ota_fee = 0.0
            if channel:
                ch_lower = channel.lower()
                if "airbnb" in ch_lower or "abb" in ch_lower:
                    ota_fee = 15.0
                elif ("booking" in ch_lower and "booking engine" not in ch_lower) or "bcom" in ch_lower or "bdc" in ch_lower:
                    ota_fee = 17.0
                    
            save_booking(
                booking_id=booking_id,
                channel=channel,
                booking_date=booking_date,
                nights=nights,
                gross_revenue=gross_revenue,
                ota_fee_percent=ota_fee,
                guest_email=guest_email
            )
            imported_count += 1
            
        logger.info(f"Mews report webhook processed: imported {imported_count} reservations")
        return {"status": "success", "imported": imported_count}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in Mews report webhook: {e}")
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
                if "airbnb" in ch_lower or "abb" in ch_lower:
                    ota_fee = 15.0
                elif ("booking" in ch_lower and "booking engine" not in ch_lower) or "bcom" in ch_lower or "bdc" in ch_lower:
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
