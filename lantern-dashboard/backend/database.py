import os
import sqlite3
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lantern_dashboard.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Create bookings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            channel TEXT NOT NULL,
            booking_date TEXT NOT NULL,
            nights INTEGER NOT NULL,
            gross_revenue REAL NOT NULL,
            ota_fee_percent REAL DEFAULT 0.0,
            net_revenue REAL NOT NULL,
            guest_email TEXT
        )
    """)
    
    # 2. Create daily_metrics table (caches GA4 and Google/Meta ad spend/clicks/impressions)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_metrics (
            date TEXT PRIMARY KEY,
            sessions INTEGER DEFAULT 0,
            pageviews INTEGER DEFAULT 0,
            checkouts_initiated INTEGER DEFAULT 0,
            google_spend REAL DEFAULT 0.0,
            google_impressions INTEGER DEFAULT 0,
            google_clicks INTEGER DEFAULT 0,
            meta_spend REAL DEFAULT 0.0,
            meta_impressions INTEGER DEFAULT 0,
            meta_views INTEGER DEFAULT 0,
            meta_clicks INTEGER DEFAULT 0
        )
    """)
    
    # 3. Create settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    
    # Insert default settings if they don't exist
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('newsletter_subscribers', '0')")
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('last_synced_at', '')")
    
    conn.commit()
    conn.close()

# --- Bookings Helpers ---
def save_booking(booking_id, channel, booking_date, nights, gross_revenue, ota_fee_percent=0.0, guest_email=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Calculate net revenue
    net_revenue = gross_revenue * (1.0 - (ota_fee_percent / 100.0))
    
    cursor.execute("""
        INSERT INTO bookings (id, channel, booking_date, nights, gross_revenue, ota_fee_percent, net_revenue, guest_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            channel=excluded.channel,
            booking_date=excluded.booking_date,
            nights=excluded.nights,
            gross_revenue=excluded.gross_revenue,
            ota_fee_percent=excluded.ota_fee_percent,
            net_revenue=excluded.net_revenue,
            guest_email=excluded.guest_email
    """, (booking_id, channel, booking_date, int(nights), float(gross_revenue), float(ota_fee_percent), float(net_revenue), guest_email))
    
    conn.commit()
    conn.close()
    return net_revenue

def get_all_bookings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings ORDER BY booking_date DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def clear_bookings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM bookings")
    conn.commit()
    conn.close()

# --- Daily Metrics Helpers ---
def save_daily_metric_row(date_str, metrics_dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Ensure all keys are populated
    sessions = metrics_dict.get('sessions', 0)
    pageviews = metrics_dict.get('pageviews', 0)
    checkouts_initiated = metrics_dict.get('checkouts_initiated', 0)
    google_spend = metrics_dict.get('google_spend', 0.0)
    google_impressions = metrics_dict.get('google_impressions', 0)
    google_clicks = metrics_dict.get('google_clicks', 0)
    meta_spend = metrics_dict.get('meta_spend', 0.0)
    meta_impressions = metrics_dict.get('meta_impressions', 0)
    meta_views = metrics_dict.get('meta_views', 0)
    meta_clicks = metrics_dict.get('meta_clicks', 0)
    
    cursor.execute("""
        INSERT INTO daily_metrics (
            date, sessions, pageviews, checkouts_initiated,
            google_spend, google_impressions, google_clicks,
            meta_spend, meta_impressions, meta_views, meta_clicks
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
            sessions=excluded.sessions,
            pageviews=excluded.pageviews,
            checkouts_initiated=excluded.checkouts_initiated,
            google_spend=excluded.google_spend,
            google_impressions=excluded.google_impressions,
            google_clicks=excluded.google_clicks,
            meta_spend=excluded.meta_spend,
            meta_impressions=excluded.meta_impressions,
            meta_views=excluded.meta_views,
            meta_clicks=excluded.meta_clicks
    """, (date_str, sessions, pageviews, checkouts_initiated,
          google_spend, google_impressions, google_clicks,
          meta_spend, meta_impressions, meta_views, meta_clicks))
    
    conn.commit()
    conn.close()

def get_daily_metrics_range(start_date=None, end_date=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if start_date and end_date:
        cursor.execute("SELECT * FROM daily_metrics WHERE date >= ? AND date <= ? ORDER BY date ASC", (start_date, end_date))
    else:
        cursor.execute("SELECT * FROM daily_metrics ORDER BY date ASC")
        
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- Settings Helpers ---
def save_setting(key, value):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
    """, (key, str(value)))
    conn.commit()
    conn.close()

def get_setting(key, default_value=""):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row['value']
    return default_value

def get_first_booking_date():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT MIN(booking_date) FROM bookings")
    row = cursor.fetchone()
    conn.close()
    return row[0] if row and row[0] else None

# Initial run to ensure tables exist
if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
