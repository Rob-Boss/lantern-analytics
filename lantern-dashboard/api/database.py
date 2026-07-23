import os
from datetime import datetime

def load_dotenv():
    search_dirs = [
        os.getcwd(),
        os.path.dirname(os.path.abspath(__file__)),
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ]
    for d in search_dirs:
        env_path = os.path.join(d, ".env")
        if os.path.isfile(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip('"').strip("'")
                            if key:
                                os.environ[key] = val
                break
            except Exception:
                pass

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
IS_POSTGRES = DATABASE_URL is not None and DATABASE_URL.startswith("postgres")

if IS_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    # Support postgresql:// prefix standard if postgres:// is passed
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    if "sslmode=" not in DATABASE_URL:
        DATABASE_URL += "?sslmode=require" if "?" not in DATABASE_URL else "&sslmode=require"
else:
    import sqlite3

def get_db_connection():
    if IS_POSTGRES:
        conn = psycopg2.connect(
            DATABASE_URL,
            cursor_factory=RealDictCursor,
            connect_timeout=10,
            options='-c statement_timeout=30000'
        )
        return conn
    else:
        DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "lantern_dashboard.db"))
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def _exec(cursor, query, params=None):
    if IS_POSTGRES:
        query = query.replace("?", "%s")
    if params is not None:
        cursor.execute(query, params)
    else:
        cursor.execute(query)

def column_exists(cursor, table_name, column_name):
    if IS_POSTGRES:
        cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_name = %s AND column_name = %s", (table_name, column_name))
        return cursor.fetchone() is not None
    else:
        cursor.execute(f"PRAGMA table_info({table_name})")
        return any(row['name'] == column_name for row in cursor.fetchall())

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Create bookings table
    _exec(cursor, """
        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            channel TEXT NOT NULL,
            booking_date TEXT NOT NULL,
            nights INTEGER NOT NULL,
            gross_revenue REAL NOT NULL,
            ota_fee_percent REAL DEFAULT 0.0,
            net_revenue REAL NOT NULL,
            guest_email TEXT,
            guest_name TEXT,
            check_in_date TEXT,
            check_out_date TEXT
        )
    """)
    conn.commit()
    
    # Migration: Ensure bookings has guest_name, check_in_date, check_out_date, cabin_name, products, notes
    for col in ("guest_name", "check_in_date", "check_out_date", "cabin_name", "products", "notes"):
        if not column_exists(cursor, "bookings", col):
            try:
                _exec(cursor, f"ALTER TABLE bookings ADD COLUMN {col} TEXT")
                conn.commit()
            except Exception:
                pass
    
    # 2. Create daily_metrics table (caches GA4 and Google/Meta ad spend/clicks/impressions)
    _exec(cursor, """
        CREATE TABLE IF NOT EXISTS daily_metrics (
            date TEXT PRIMARY KEY,
            sessions INTEGER DEFAULT 0,
            pageviews INTEGER DEFAULT 0,
            checkouts_initiated INTEGER DEFAULT 0,
            new_users INTEGER DEFAULT 0,
            active_users INTEGER DEFAULT 0,
            google_spend REAL DEFAULT 0.0,
            google_impressions INTEGER DEFAULT 0,
            google_clicks INTEGER DEFAULT 0,
            meta_spend REAL DEFAULT 0.0,
            meta_impressions INTEGER DEFAULT 0,
            meta_views INTEGER DEFAULT 0,
            meta_clicks INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    
    # Migration: Ensure daily_metrics has new_users and active_users
    for col in ("new_users", "active_users"):
        if not column_exists(cursor, "daily_metrics", col):
            try:
                _exec(cursor, f"ALTER TABLE daily_metrics ADD COLUMN {col} INTEGER DEFAULT 0")
                conn.commit()
            except Exception:
                pass
    
    # 3. Create settings table
    _exec(cursor, """
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    
    # Insert default settings if they don't exist
    _exec(cursor, "INSERT INTO settings (key, value) VALUES ('newsletter_subscribers', '0') ON CONFLICT (key) DO NOTHING")
    _exec(cursor, "INSERT INTO settings (key, value) VALUES ('last_synced_at', '') ON CONFLICT (key) DO NOTHING")
    
    # 4. Create geo_metrics table
    _exec(cursor, """
        CREATE TABLE IF NOT EXISTS geo_metrics (
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            users INTEGER DEFAULT 0,
            PRIMARY KEY (date, type, name)
        )
    """)
    
    conn.commit()
    conn.close()

# --- Bookings Helpers ---
def save_booking(booking_id, channel, booking_date, nights, gross_revenue, ota_fee_percent=0.0, guest_email=None, guest_name=None, check_in_date=None, check_out_date=None, cabin_name=None, products=None, notes=None, status=None, origin=None, guest_phone=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Calculate net revenue
    net_revenue = gross_revenue * (1.0 - (ota_fee_percent / 100.0))

    # Auto-detect waiver signed status for Mews direct booking engine or checked-in stays
    ch_lower = (channel or "").lower()
    orig_lower = (origin or "").lower()
    stat_lower = (status or "").lower()

    is_booking_engine = "booking engine" in ch_lower or "booking engine" in orig_lower or ("mews" in ch_lower and "direct" in ch_lower)
    is_checked_in = stat_lower in ("checked in", "checked out")
    auto_waiver_signed = "true" if (is_booking_engine or is_checked_in) else None

    _exec(cursor, """
        INSERT INTO bookings (id, channel, booking_date, nights, gross_revenue, ota_fee_percent, net_revenue, guest_email, guest_name, check_in_date, check_out_date, cabin_name, products, notes, status, origin, waiver_signed, guest_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            channel=excluded.channel,
            booking_date=excluded.booking_date,
            nights=excluded.nights,
            gross_revenue=excluded.gross_revenue,
            ota_fee_percent=excluded.ota_fee_percent,
            net_revenue=excluded.net_revenue,
            guest_email=COALESCE(NULLIF(excluded.guest_email, ''), bookings.guest_email),
            guest_name=excluded.guest_name,
            guest_phone=COALESCE(NULLIF(excluded.guest_phone, ''), bookings.guest_phone),
            check_in_date=excluded.check_in_date,
            check_out_date=excluded.check_out_date,
            cabin_name=excluded.cabin_name,
            products=COALESCE(excluded.products, bookings.products),
            notes=CASE WHEN excluded.notes IS NOT NULL AND excluded.notes != '' THEN excluded.notes ELSE bookings.notes END,
            status=COALESCE(excluded.status, bookings.status),
            origin=COALESCE(excluded.origin, bookings.origin),
            waiver_signed=CASE 
                WHEN bookings.waiver_signed = 'true' THEN 'true'
                WHEN excluded.waiver_signed = 'true' THEN 'true'
                ELSE COALESCE(bookings.waiver_signed, excluded.waiver_signed)
            END
    """, (booking_id, channel, booking_date, int(nights), float(gross_revenue), float(ota_fee_percent), float(net_revenue), guest_email, guest_name, check_in_date, check_out_date, cabin_name, products, notes, status, origin, auto_waiver_signed, guest_phone))
    
    conn.commit()
    conn.close()
    return net_revenue

def clear_bookings():
    """No-op alias to maintain import compatibility."""
    pass

def get_all_bookings():
    conn = get_db_connection()
    cursor = conn.cursor()
    _exec(cursor, """
        SELECT b.id, b.channel, b.booking_date, b.nights, b.gross_revenue, b.ota_fee_percent, b.net_revenue, 
               COALESCE(NULLIF(b.guest_email, ''), w.guest_email) AS guest_email,
               COALESCE(NULLIF(b.guest_name, ''), w.guest_name) AS guest_name,
               COALESCE(NULLIF(b.guest_phone, ''), w.guest_phone) AS guest_phone,
               b.check_in_date, b.check_out_date,
               COALESCE(s.assigned_cabin, b.cabin_name) AS cabin_name,
               b.products, b.notes, b.status, b.origin,
               CASE 
                 WHEN w.id IS NOT NULL OR b.waiver_signed = 'true' THEN 'true' 
                 ELSE COALESCE(b.waiver_signed, 'false') 
               END AS waiver_signed,
               COALESCE(w.signed_at, b.waiver_signed_at) AS waiver_signed_at,
               COALESCE(s.message_sent, b.message_sent, 'false') AS message_sent,
               COALESCE(s.sent_at, b.message_sent_at) AS message_sent_at
        FROM bookings b
        LEFT JOIN waiver_signatures w ON (
            (b.id IS NOT NULL AND b.id != '' AND w.booking_id = b.id)
            OR (b.notes IS NOT NULL AND b.notes != '' AND w.booking_id IS NOT NULL AND w.booking_id != '' AND b.notes LIKE '%%' || w.booking_id || '%%')
            OR (w.guest_email IS NOT NULL AND w.guest_email != '' AND b.guest_email IS NOT NULL AND b.guest_email != '' AND LOWER(b.guest_email) = LOWER(w.guest_email))
            OR (w.guest_phone IS NOT NULL AND b.guest_phone IS NOT NULL AND LOWER(w.guest_phone) = LOWER(b.guest_phone))
            OR (w.guest_name IS NOT NULL AND w.guest_name != '' AND b.guest_name IS NOT NULL AND b.guest_name != '' AND LOWER(b.guest_name) = LOWER(w.guest_name))
        )
        LEFT JOIN sms_dispatches s ON b.id = s.booking_id
        ORDER BY b.booking_date DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def clear_bookings():
    conn = get_db_connection()
    cursor = conn.cursor()
    _exec(cursor, "DELETE FROM bookings")
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
    new_users = metrics_dict.get('new_users', 0)
    active_users = metrics_dict.get('active_users', 0)
    google_spend = metrics_dict.get('google_spend', 0.0)
    google_impressions = metrics_dict.get('google_impressions', 0)
    google_clicks = metrics_dict.get('google_clicks', 0)
    meta_spend = metrics_dict.get('meta_spend', 0.0)
    meta_impressions = metrics_dict.get('meta_impressions', 0)
    meta_views = metrics_dict.get('meta_views', 0)
    meta_clicks = metrics_dict.get('meta_clicks', 0)
    
    _exec(cursor, """
        INSERT INTO daily_metrics (
            date, sessions, pageviews, checkouts_initiated,
            new_users, active_users,
            google_spend, google_impressions, google_clicks,
            meta_spend, meta_impressions, meta_views, meta_clicks
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
            sessions=excluded.sessions,
            pageviews=excluded.pageviews,
            checkouts_initiated=excluded.checkouts_initiated,
            new_users=excluded.new_users,
            active_users=excluded.active_users,
            google_spend=excluded.google_spend,
            google_impressions=excluded.google_impressions,
            google_clicks=excluded.google_clicks,
            meta_spend=excluded.meta_spend,
            meta_impressions=excluded.meta_impressions,
            meta_views=excluded.meta_views,
            meta_clicks=excluded.meta_clicks
    """, (date_str, sessions, pageviews, checkouts_initiated,
          new_users, active_users,
          google_spend, google_impressions, google_clicks,
          meta_spend, meta_impressions, meta_views, meta_clicks))
    
    conn.commit()
    conn.close()

def get_daily_metrics_range(start_date=None, end_date=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if start_date and end_date:
        _exec(cursor, "SELECT * FROM daily_metrics WHERE date >= ? AND date <= ? ORDER BY date ASC", (start_date, end_date))
    else:
        _exec(cursor, "SELECT * FROM daily_metrics ORDER BY date ASC")
        
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- Settings Helpers ---
def save_setting(key, value):
    conn = get_db_connection()
    cursor = conn.cursor()
    _exec(cursor, """
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
    """, (key, str(value)))
    conn.commit()
    conn.close()

def get_setting(key, default_value=""):
    conn = get_db_connection()
    cursor = conn.cursor()
    _exec(cursor, "SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row['value']
    return default_value

def get_first_booking_date():
    conn = get_db_connection()
    cursor = conn.cursor()
    _exec(cursor, "SELECT MIN(booking_date) AS min_date FROM bookings")
    row = cursor.fetchone()
    conn.close()
    return row['min_date'] if row and row['min_date'] else None

def save_geo_metric(date_str, metric_type, name, users):
    conn = get_db_connection()
    cursor = conn.cursor()
    if IS_POSTGRES:
        _exec(cursor, """
            INSERT INTO geo_metrics (date, type, name, users)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (date, type, name)
            DO UPDATE SET users = EXCLUDED.users
        """, (date_str, metric_type, name, users))
    else:
        _exec(cursor, """
            INSERT INTO geo_metrics (date, type, name, users)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (date, type, name)
            DO UPDATE SET users = excluded.users
        """, (date_str, metric_type, name, users))
    conn.commit()
    conn.close()

def get_geo_metrics(start_date, end_date, metric_type, limit=15):
    conn = get_db_connection()
    cursor = conn.cursor()
    _exec(cursor, """
        SELECT name, SUM(users) as total_users
        FROM geo_metrics
        WHERE type = ? AND date >= ? AND date <= ?
        GROUP BY name
        ORDER BY total_users DESC
        LIMIT ?
    """, (metric_type, start_date, end_date, limit))
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        if IS_POSTGRES:
            name_val = r['name']
            users_val = int(r['total_users'] or 0)
        else:
            name_val = r[0]
            users_val = int(r[1] or 0)
            
        if metric_type == "region":
            results.append({"region": name_val, "users": users_val})
        else:
            results.append({"city": name_val, "users": users_val})
    return results

def save_geo_metrics_batch(rows):
    """Saves a list of (date_str, metric_type, name, users) tuples in bulk."""
    if not rows:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if IS_POSTGRES:
        from psycopg2.extras import execute_values
        query = """
            INSERT INTO geo_metrics (date, type, name, users)
            VALUES %s
            ON CONFLICT (date, type, name)
            DO UPDATE SET users = EXCLUDED.users
        """
        execute_values(cursor, query, rows)
    else:
        cursor.execute("BEGIN TRANSACTION")
        for r in rows:
            cursor.execute("""
                INSERT INTO geo_metrics (date, type, name, users)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (date, type, name)
                DO UPDATE SET users = excluded.users
            """, r)
        cursor.execute("COMMIT")
        
    conn.commit()
    conn.close()

def update_message_sent(booking_id, is_sent=True, sent_at=None, assigned_cabin=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    sent_str = str(is_sent).lower()
    
    # 1. Permanent sidecar table update
    _exec(cursor, """
        INSERT INTO sms_dispatches (booking_id, message_sent, sent_at, assigned_cabin)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(booking_id) DO UPDATE SET
            message_sent = EXCLUDED.message_sent,
            sent_at = EXCLUDED.sent_at,
            assigned_cabin = COALESCE(EXCLUDED.assigned_cabin, sms_dispatches.assigned_cabin)
    """, (str(booking_id), sent_str, sent_at, assigned_cabin))
    
    # 2. Backwards compatible update on bookings table
    _exec(cursor, """
        UPDATE bookings 
        SET message_sent = ?, message_sent_at = ?, cabin_name = COALESCE(?, cabin_name)
        WHERE id = ?
    """, (sent_str, sent_at, assigned_cabin, str(booking_id)))
    conn.commit()
    conn.close()

def get_operations_calendar(date_str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Calculate date_plus_7
    try:
        from datetime import datetime, timedelta
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        dt_plus_7 = (dt + timedelta(days=7)).strftime("%Y-%m-%d")
    except Exception:
        dt_plus_7 = date_str  # fallback

    base_select = """
        SELECT b.id, b.channel, 
               COALESCE(NULLIF(b.guest_name, ''), w.guest_name) AS guest_name,
               COALESCE(NULLIF(b.guest_email, ''), w.guest_email) AS guest_email,
               COALESCE(NULLIF(b.guest_phone, ''), w.guest_phone) AS guest_phone,
               b.check_in_date, b.check_out_date,
               COALESCE(s.assigned_cabin, b.cabin_name) AS cabin_name,
               b.products, b.notes, b.status, b.origin,
               CASE WHEN w.id IS NOT NULL OR b.waiver_signed = 'true' THEN 'true' ELSE COALESCE(b.waiver_signed, 'false') END AS waiver_signed
        FROM bookings b
        LEFT JOIN waiver_signatures w ON (
            (b.id IS NOT NULL AND b.id != '' AND w.booking_id = b.id)
            OR (b.notes IS NOT NULL AND b.notes != '' AND w.booking_id IS NOT NULL AND w.booking_id != '' AND b.notes LIKE '%%' || w.booking_id || '%%')
            OR (w.guest_email IS NOT NULL AND w.guest_email != '' AND b.guest_email IS NOT NULL AND b.guest_email != '' AND LOWER(b.guest_email) = LOWER(w.guest_email))
            OR (w.guest_phone IS NOT NULL AND b.guest_phone IS NOT NULL AND LOWER(w.guest_phone) = LOWER(b.guest_phone))
            OR (w.guest_name IS NOT NULL AND w.guest_name != '' AND b.guest_name IS NOT NULL AND b.guest_name != '' AND LOWER(b.guest_name) = LOWER(w.guest_name))
        )
        LEFT JOIN sms_dispatches s ON b.id = s.booking_id
    """
        
    # Arrivals query
    query_arrivals = base_select + " WHERE b.check_in_date = ? ORDER BY cabin_name ASC"
    _exec(cursor, query_arrivals, (date_str,))
    arrivals = [dict(r) for r in cursor.fetchall()]
    
    # Departures query
    query_departures = base_select + " WHERE b.check_out_date = ? ORDER BY cabin_name ASC"
    _exec(cursor, query_departures, (date_str,))
    departures = [dict(r) for r in cursor.fetchall()]
    
    # In-house query (guests checked in on or before date_str and checking out after date_str)
    query_in_house = base_select + " WHERE b.check_in_date <= ? AND b.check_out_date > ? ORDER BY cabin_name ASC"
    _exec(cursor, query_in_house, (date_str, date_str))
    in_house = [dict(r) for r in cursor.fetchall()]
    
    # 7-day upcoming add-ons forecast query
    query_addons = base_select + """ 
        WHERE b.check_in_date > ? AND b.check_in_date <= ?
          AND (b.products LIKE ? OR b.products LIKE ? OR b.products LIKE ?)
        ORDER BY b.check_in_date ASC
    """
    _exec(cursor, query_addons, (date_str, dt_plus_7, "%%Stargazing%%", "%%Walk%%", "%%Pet%%"))
    addons = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    return {
        "arrivals": arrivals,
        "departures": departures,
        "in_house": in_house,
        "upcoming_addons": addons
    }

# Initial run to ensure tables exist
if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
