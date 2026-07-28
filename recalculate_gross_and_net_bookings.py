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

# 1. Update Airbnb bookings in Neon DB
# For Airbnb, Mews amount (stored previously) is the Net Host Payout.
# We set ota_fee_percent = 15.5
# net_revenue = net host payout (Mews amount)
# gross_revenue = net_revenue / (1.0 - 0.155) = net_revenue / 0.845
cursor.execute("""
    UPDATE bookings
    SET ota_fee_percent = 15.5,
        net_revenue = gross_revenue,
        gross_revenue = gross_revenue / 0.845
    WHERE LOWER(channel) LIKE '%airbnb%' OR LOWER(channel) LIKE '%abb%'
""")
updated_count = cursor.rowcount
conn.commit()

print(f"Updated {updated_count} Airbnb records in Neon DB with True Gross (15.5% fee reconstructed) and True Net payout.")

# 2. Inspect period stats for Previous Week and Last Week
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
            COALESCE(SUM(gross_revenue), 0) as gross,
            COALESCE(SUM(net_revenue), 0) as net
        FROM bookings
        WHERE booking_date >= %s AND booking_date <= %s AND (LOWER(channel) LIKE '%%mews%%' OR LOWER(channel) LIKE '%%direct%%')
    """, (start_date, end_date))
    mews = cursor.fetchone()
    
    cursor.execute("""
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(gross_revenue), 0) as gross,
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
        "mews_gross": float(mews['gross']),
        "mews_net": float(mews['net']),
        "airbnb_count": airbnb['count'],
        "airbnb_gross": float(airbnb['gross']),
        "airbnb_net": float(airbnb['net'])
    }

pw = get_period_stats("2026-07-12", "2026-07-18")
lw = get_period_stats("2026-07-19", "2026-07-25")

print("\n=== RECALCULATED PREVIOUS WEEK (July 12-18) ===")
print(f"Total Bookings: {pw['total_count']} | Gross Revenue (Guest Paid): ${pw['gross']:.2f} | Net Revenue (Host Payout): ${pw['net']:.2f} | Total OTA Fees: ${pw['gross'] - pw['net']:.2f}")
print(f"  Mews Direct: {pw['mews_count']} bookings | Gross: ${pw['mews_gross']:.2f} | Net: ${pw['mews_net']:.2f}")
print(f"  Airbnb: {pw['airbnb_count']} bookings | Gross: ${pw['airbnb_gross']:.2f} | Net: ${pw['airbnb_net']:.2f} | Airbnb Fees (15.5%): ${pw['airbnb_gross'] - pw['airbnb_net']:.2f}")

print("\n=== RECALCULATED LAST WEEK (July 19-25) ===")
print(f"Total Bookings: {lw['total_count']} | Gross Revenue (Guest Paid): ${lw['gross']:.2f} | Net Revenue (Host Payout): ${lw['net']:.2f} | Total OTA Fees: ${lw['gross'] - lw['net']:.2f}")
print(f"  Mews Direct: {lw['mews_count']} bookings | Gross: ${lw['mews_gross']:.2f} | Net: ${lw['mews_net']:.2f}")
print(f"  Airbnb: {lw['airbnb_count']} bookings | Gross: ${lw['airbnb_gross']:.2f} | Net: ${lw['airbnb_net']:.2f} | Airbnb Fees (15.5%): ${lw['airbnb_gross'] - lw['airbnb_net']:.2f}")

conn.close()
