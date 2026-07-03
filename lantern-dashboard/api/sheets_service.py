import os
import logging
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials

try:
    from .database import save_booking, get_setting
    from .credentials_loader import get_ga4_creds_path
except ImportError:
    from database import save_booking, get_setting
    from credentials_loader import get_ga4_creds_path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Paths to credentials (relative to parent directory of this file, or loaded from env)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GA4_CREDS_PATH = get_ga4_creds_path(BASE_DIR)

def sync_bookings_from_sheet(spreadsheet_id: str, range_name: str = "Sheet1!A1:Z5000"):
    """Fetches bookings from a Google Sheet using the GA4 service account credentials."""
    logger.info(f"Connecting to Google Sheet ID: {spreadsheet_id} with range: {range_name}")
    
    if not os.path.exists(GA4_CREDS_PATH):
        raise FileNotFoundError(f"Google credentials file not found at {GA4_CREDS_PATH}")
        
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds = Credentials.from_service_account_file(GA4_CREDS_PATH, scopes=scopes)
    service = build("sheets", "v4", credentials=creds)
    
    # Call the Sheets API
    sheet = service.spreadsheets()
    
    # 1. Fetch spreadsheet metadata to find the name of the first tab dynamically
    spreadsheet_metadata = sheet.get(spreadsheetId=spreadsheet_id).execute()
    sheets = spreadsheet_metadata.get("sheets", [])
    if not sheets:
        raise ValueError("No worksheets found in this spreadsheet.")
    first_sheet_name = sheets[0].get("properties", {}).get("title", "Sheet1")
    logger.info(f"Auto-detected first worksheet name: {first_sheet_name}")
    
    # 2. Query values from that worksheet
    resolved_range = f"'{first_sheet_name}'!A1:Z5000"
    result = sheet.values().get(spreadsheetId=spreadsheet_id, range=resolved_range).execute()
    rows = result.get("values", [])
    
    if not rows:
        logger.warning("Google Sheet returned empty or no values.")
        return 0, ["The specified range is empty or returned no rows."]
        
    header = rows[0]
    header_map = {col.strip().lower(): idx for idx, col in enumerate(header)}
    
    # Helper to find index of possible column names
    def find_col_idx(aliases):
        for alias in aliases:
            if alias in header_map:
                return header_map[alias]
        return None
        
    # Map column headers dynamically
    id_idx = find_col_idx(["id", "confirmation number", "reservation number", "number", "reservation id"])
    channel_idx = find_col_idx(["channel", "source", "reservation source", "origin", "type"])
    date_idx = find_col_idx(["date", "booking date", "booking_date", "created", "start", "start date", "arrival"])
    nights_idx = find_col_idx(["nights", "duration", "nights count"])
    gross_idx = find_col_idx(["gross revenue", "gross_revenue", "revenue", "gross value", "price", "amount"])
    fee_idx = find_col_idx(["ota fee %", "ota fee percent", "fee %", "ota fee"])
    email_idx = find_col_idx(["guest email", "guest_email", "email", "reservation owner email"])
    
    if None in (id_idx, channel_idx, date_idx, nights_idx, gross_idx):
        raise ValueError(
            "Google Sheet is missing required columns. Make sure row 1 contains headers like: "
            "Confirmation Number / ID, Reservation Source / Channel, Date / Arrival, Nights / Duration, Gross Revenue / Price."
        )
        
    count = 0
    errors = []
    
    for row_idx, row in enumerate(rows[1:]):
        # Ensure row has enough cells populated to get the necessary columns
        max_required_idx = max(id_idx, channel_idx, date_idx, nights_idx, gross_idx)
        if not row or len(row) <= max_required_idx:
            continue
            
        try:
            booking_id = row[id_idx].strip()
            if not booking_id:
                continue
                
            channel = row[channel_idx].strip()
            
            # Clean and parse date
            date_raw = row[date_idx].strip()
            booking_date = None
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%m/%d/%y"):
                try:
                    dt = datetime.strptime(date_raw.split(" ")[0], fmt)
                    booking_date = dt.strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
            
            if not booking_date:
                raise ValueError(f"Could not parse date value: {date_raw}")
                
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
        except Exception as e:
            errors.append(f"Row {row_idx + 2} (Index {row_idx}): {e}")
            
    logger.info(f"Sheet Sync Complete! Imported {count} bookings. Warnings: {len(errors)}")
    return count, errors

if __name__ == "__main__":
    import sys
    
    # Resolve the spreadsheet ID from settings, env or argument
    sheet_id = os.environ.get("MEWS_SHEET_ID")
    if not sheet_id:
        try:
            sheet_id = get_setting("mews_sheet_id")
        except Exception:
            pass
            
    if len(sys.argv) > 1:
        sheet_id = sys.argv[1]
        
    if not sheet_id:
        print("\n[Error] Google Sheet ID not found!")
        print("Please configure the Mews Sheet ID in your dashboard settings first, or pass it as an argument:")
        print("Usage: .venv/bin/python lantern-dashboard/api/sheets_service.py <spreadsheet_id>\n")
        sys.exit(1)
        
    print(f"\nStarting Google Sheets bookings import for ID: {sheet_id}")
    try:
        count, errors = sync_bookings_from_sheet(sheet_id)
        print(f"Success! Imported {count} bookings to Neon database.")
        if errors:
            print(f"Warnings/errors encountered: {len(errors)}")
            for err in errors[:10]:
                print(f" - {err}")
    except Exception as exc:
        print(f"Failed to sync bookings: {exc}")
        sys.exit(1)
