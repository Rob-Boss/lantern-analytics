import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local_sync")

try:
    from sync_service import sync_data
    from sheets_service import sync_bookings_from_sheet
    from database import get_setting
except ImportError:
    from api.sync_service import sync_data
    from api.sheets_service import sync_bookings_from_sheet
    from api.database import get_setting

def main():
    logger.info("================ STARTING MASTER LOCAL SYNC ================")
    
    # Run database initialization & migration to ensure new columns exist
    try:
        from database import init_db
    except ImportError:
        from api.database import init_db
    try:
        init_db()
        logger.info("Database initialized/migrated successfully.")
    except Exception as e:
        logger.warning(f"Database migration warning: {e}")
        
    # 1. Sync Marketing APIs (Google Ads, Meta Ads, GA4)
    logger.info("Step 1: Syncing Marketing Spend & Traffic (GA4, Google Ads, Meta Ads) for the last 60 days...")
    try:
        sync_data(days=60)
        logger.info("Step 1 Complete! Marketing spend & traffic updated successfully.")
    except Exception as e:
        logger.error(f"Step 1 Failed: {e}")
        
    # 2. Sync Google Sheets Bookings (DISABLED: Mews reports are now the sole database bookings source of truth)
    logger.info("Step 2: Syncing Bookings from Google Sheets (Skipped - database updates directly from Mews reports).")
            
    # 3. Run Google Ads Budget Rollover Auto-Pacing (Disabled: letting Google handle pacing natively)
    # logger.info("Step 3: Running Google Ads budget rollover auto-pacing...")
    # try:
    #     # Resolve path to import google_budget_rollover from root
    #     root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    #     if root_dir not in sys.path:
    #         sys.path.append(root_dir)
    #     import google_budget_rollover
    #     google_budget_rollover.main()
    #     logger.info("Step 3 Complete! Google Ads budget rollover executed.")
    # except Exception as e:
    #     logger.error(f"Step 3 Failed: {e}")
            
    logger.info("================ MASTER LOCAL SYNC COMPLETE ================")

if __name__ == "__main__":
    main()
