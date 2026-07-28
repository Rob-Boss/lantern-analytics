import os
import psycopg2
from psycopg2.extras import RealDictCursor

env_path = ".env"
db_url = None
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not db_url:
    db_url = os.environ.get("DATABASE_URL")

if "sslmode=" not in db_url:
    db_url += "?sslmode=require" if "?" not in db_url else "&sslmode=require"

conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
cursor = conn.cursor()

# 1. Inspect total before update
cursor.execute("""
    SELECT 
        booking_date,
        SUM(net_revenue) as total_net,
        SUM(gross_revenue) as total_gross
    FROM bookings
    WHERE booking_date >= '2026-07-12' AND booking_date <= '2026-07-25'
    GROUP BY booking_date
""")

# 2. Update Airbnb records in Neon DB
cursor.execute("""
    UPDATE bookings
    SET ota_fee_percent = 0.0,
        net_revenue = gross_revenue
    WHERE LOWER(channel) LIKE '%airbnb%' OR LOWER(channel) LIKE '%abb%'
""")
updated_count = cursor.rowcount
conn.commit()

print(f"Successfully updated {updated_count} Airbnb booking records in Neon DB!")

# 3. Inspect updated stats for Previous Week and Last Week
def get_period_stats(start_date, end_date):
    cursor.execute("""
        SELECT 
            COUNT(*) as booking_count,
            COALESCE(SUM(gross_revenue), 0) as gross,
            COALESCE(SUM(net_revenue), 0) as net
        FROM bookings
        WHERE booking_date >= %s AND booking_date <= %s
    """, (start_date, end_date))
    total = cursor.fetchone()
    
    cursor.execute("""
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(net_revenue), 0) as net
        FROM bookings
        WHERE booking_date >= %s AND booking_date <= %s AND (LOWER(channel) LIKE '%%mews%%' OR LOWER(channel) LIKE '%%direct%%')
    """, (start_date, end_date))
    mews = cursor.fetchone()
    
    cursor.execute("""
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(net_revenue), 0) as net
        FROM bookings
        WHERE booking_date >= %s AND booking_date <= %s AND (LOWER(channel) LIKE '%%airbnb%%' OR LOWER(channel) LIKE '%%abb%%')
    """, (start_date, end_date))
    airbnb = cursor.fetchone()
    
    return {
        "total_count": total['booking_count'],
        "gross": float(total['gross']),
        "net": float(total['net']),
        "mews_count": mews['count'],
        "mews_net": float(mews['net']),
        "airbnb_count": airbnb['count'],
        "airbnb_net": float(airbnb['net'])
    }

pw = get_period_stats("2026-07-12", "2026-07-18")
lw = get_period_stats("2026-07-19", "2026-07-25")

print("\n=== UPDATED PREVIOUS WEEK (July 12-18) ===")
print(f"Total Bookings: {pw['total_count']} | Gross: ${pw['gross']:.2f} | Net Revenue: ${pw['net']:.2f}")
print(f"  Mews Direct: {pw['mews_count']} bookings | Net: ${pw['mews_net']:.2f}")
print(f"  Airbnb: {pw['airbnb_count']} bookings | Net: ${pw['airbnb_net']:.2f}")

print("\n=== UPDATED LAST WEEK (July 19-25) ===")
print(f"Total Bookings: {lw['total_count']} | Gross: ${lw['gross']:.2f} | Net Revenue: ${lw['net']:.2f}")
print(f"  Mews Direct: {lw['mews_count']} bookings | Net: ${lw['mews_net']:.2f}")
print(f"  Airbnb: {lw['airbnb_count']} bookings | Net: ${lw['airbnb_net']:.2f}")

conn.close()
