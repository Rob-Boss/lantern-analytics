import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json

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

def fetch_bookings_for_period(start_date, end_date):
    cursor.execute("""
        SELECT 
            id,
            channel,
            booking_date,
            nights,
            gross_revenue,
            net_revenue,
            guest_name,
            check_in_date,
            check_out_date,
            cabin_name
        FROM bookings
        WHERE booking_date >= %s AND booking_date <= %s
        ORDER BY booking_date ASC, id ASC
    """, (start_date, end_date))
    rows = cursor.fetchall()
    return [dict(r) for r in rows]

prev_week_bookings = fetch_bookings_for_period("2026-07-12", "2026-07-18")
last_week_bookings = fetch_bookings_for_period("2026-07-19", "2026-07-25")

print(f"=== PREVIOUS WEEK (July 12 - July 18): {len(prev_week_bookings)} Bookings ===")
for b in prev_week_bookings:
    print(f"ID: {b['id']} | Date: {b['booking_date']} | Channel: {b['channel']} | Nights: {b['nights']} | Gross: ${b['gross_revenue']:.2f} | Net: ${b['net_revenue']:.2f} | Guest: {b.get('guest_name')}")

print(f"\n=== LAST WEEK (July 19 - July 25): {len(last_week_bookings)} Bookings ===")
for b in last_week_bookings:
    print(f"ID: {b['id']} | Date: {b['booking_date']} | Channel: {b['channel']} | Nights: {b['nights']} | Gross: ${b['gross_revenue']:.2f} | Net: ${b['net_revenue']:.2f} | Guest: {b.get('guest_name')}")

def analyze(b_list, label):
    total_count = len(b_list)
    total_nights = sum(b['nights'] for b in b_list)
    total_gross = sum(b['gross_revenue'] for b in b_list)
    total_net = sum(b['net_revenue'] for b in b_list)
    avg_nights = total_nights / total_count if total_count > 0 else 0
    avg_gross_per_booking = total_gross / total_count if total_count > 0 else 0
    avg_net_per_booking = total_net / total_count if total_count > 0 else 0
    avg_rev_per_night = total_net / total_nights if total_nights > 0 else 0
    return {
        "label": label,
        "count": total_count,
        "total_nights": total_nights,
        "total_gross": total_gross,
        "total_net": total_net,
        "avg_nights_per_booking": avg_nights,
        "avg_gross_per_booking": avg_gross_per_booking,
        "avg_net_per_booking": avg_net_per_booking,
        "avg_net_rev_per_night": avg_rev_per_night
    }

pw_stats = analyze(prev_week_bookings, "Previous Week (July 12-18)")
lw_stats = analyze(last_week_bookings, "Last Week (July 19-25)")

print("\n=== SUMMARY COMPARISON ===")
print(json.dumps({"prev_week": pw_stats, "last_week": lw_stats}, indent=2))
