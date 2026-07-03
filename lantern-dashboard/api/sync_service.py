import os
import json
import logging
from datetime import datetime, date, timedelta
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest,
    DateRange,
    Metric,
    Dimension,
    FilterExpression,
    Filter,
)
import requests

# Import database helpers (ensuring parent directory/module path works)
try:
    from .database import save_daily_metric_row, save_setting
    from .credentials_loader import get_ga4_creds_path, get_meta_creds_path, get_google_ads_yaml_path
except ImportError:
    from database import save_daily_metric_row, save_setting
    from credentials_loader import get_ga4_creds_path, get_meta_creds_path, get_google_ads_yaml_path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Paths to credentials (relative to parent directory of this file, or loaded from env)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GA4_CREDS_PATH = get_ga4_creds_path(BASE_DIR)
GOOGLE_ADS_YAML_PATH = get_google_ads_yaml_path(BASE_DIR)
META_CREDS_PATH = get_meta_creds_path(BASE_DIR)

GA4_PROPERTY_ID = "534706583"
META_AD_ACCOUNT_ID = "act_1585226713251054"

def get_action_value(actions, action_type):
    if not actions:
        return 0
    for action in actions:
        if action.get("action_type") == action_type:
            return int(action.get("value", 0))
    return 0

def fetch_ga4_metrics(start_date_str, end_date_str):
    """Fetches daily sessions, pageviews, and begin_checkout events from GA4."""
    logger.info(f"Fetching GA4 metrics from {start_date_str} to {end_date_str}")
    results = {}
    
    if not os.path.exists(GA4_CREDS_PATH):
        logger.warning(f"GA4 credentials file not found at {GA4_CREDS_PATH}. Skipping GA4 sync.")
        return results
        
    try:
        client = BetaAnalyticsDataClient.from_service_account_json(GA4_CREDS_PATH)
        
        # 1. Query sessions, pageviews (screenPageViews), newUsers, and activeUsers
        traffic_request = RunReportRequest(
            property=f"properties/{GA4_PROPERTY_ID}",
            date_ranges=[DateRange(start_date=start_date_str, end_date=end_date_str)],
            dimensions=[Dimension(name="date")],
            metrics=[
                Metric(name="sessions"),
                Metric(name="screenPageViews"),
                Metric(name="newUsers"),
                Metric(name="activeUsers")
            ]
        )
        
        traffic_response = client.run_report(traffic_request)
        for row in traffic_response.rows:
            date_raw = row.dimension_values[0].value  # Format: YYYYMMDD
            date_formatted = f"{date_raw[0:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
            sessions = int(row.metric_values[0].value)
            pageviews = int(row.metric_values[1].value)
            new_users = int(row.metric_values[2].value)
            active_users = int(row.metric_values[3].value)
            
            if date_formatted not in results:
                results[date_formatted] = {}
            results[date_formatted]["sessions"] = sessions
            results[date_formatted]["pageviews"] = pageviews
            results[date_formatted]["new_users"] = new_users
            results[date_formatted]["active_users"] = active_users
            
        # 2. Query begin_checkout events
        checkout_request = RunReportRequest(
            property=f"properties/{GA4_PROPERTY_ID}",
            date_ranges=[DateRange(start_date=start_date_str, end_date=end_date_str)],
            dimensions=[Dimension(name="date")],
            metrics=[Metric(name="eventCount")],
            dimension_filter=FilterExpression(
                filter=Filter(
                    field_name="eventName",
                    string_filter=Filter.StringFilter(value="begin_checkout")
                )
            )
        )
        
        checkout_response = client.run_report(checkout_request)
        for row in checkout_response.rows:
            date_raw = row.dimension_values[0].value
            date_formatted = f"{date_raw[0:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
            checkouts = int(row.metric_values[0].value)
            
            if date_formatted not in results:
                results[date_formatted] = {}
            results[date_formatted]["checkouts_initiated"] = checkouts
            
    except Exception as e:
        logger.error(f"Error fetching GA4 metrics: {e}")
        
    return results

def fetch_google_ads_metrics(start_date_str, end_date_str):
    """Fetches daily spend, impressions, and clicks from Google Ads."""
    logger.info(f"Fetching Google Ads metrics from {start_date_str} to {end_date_str}")
    results = {}
    
    if not os.path.exists(GOOGLE_ADS_YAML_PATH):
        logger.warning(f"Google Ads config not found at {GOOGLE_ADS_YAML_PATH}. Skipping Google Ads sync.")
        return results
        
    try:
        googleads_client = GoogleAdsClient.load_from_storage(path=GOOGLE_ADS_YAML_PATH)
        customer_id = str(googleads_client.login_customer_id).replace("-", "")
        googleads_service = googleads_client.get_service("GoogleAdsService")
        
        # Query Google Ads daily
        query = f"""
            SELECT
              segments.date,
              metrics.cost_micros,
              metrics.impressions,
              metrics.clicks
            FROM campaign
            WHERE segments.date >= '{start_date_str}' AND segments.date <= '{end_date_str}'
        """
        
        search_request = googleads_client.get_type("SearchGoogleAdsRequest")
        search_request.customer_id = customer_id
        search_request.query = query
        
        response = googleads_service.search(request=search_request)
        for row in response:
            date_str = row.segments.date  # YYYY-MM-DD
            cost = row.metrics.cost_micros / 1000000.0
            impressions = row.metrics.impressions
            clicks = row.metrics.clicks
            
            if date_str not in results:
                results[date_str] = {"google_spend": 0.0, "google_impressions": 0, "google_clicks": 0}
            
            results[date_str]["google_spend"] += cost
            results[date_str]["google_impressions"] += impressions
            results[date_str]["google_clicks"] += clicks
            
    except GoogleAdsException as ex:
        logger.error(f"Google Ads API Error: {ex}")
    except Exception as e:
        logger.error(f"Error fetching Google Ads metrics: {e}")
        
    return results

def fetch_meta_ads_metrics(start_date_str, end_date_str):
    """Fetches daily spend, impressions, clicks, and landing page views from Meta Ads."""
    logger.info(f"Fetching Meta Ads metrics from {start_date_str} to {end_date_str}")
    results = {}
    
    if not os.path.exists(META_CREDS_PATH):
        logger.warning(f"Meta credentials file not found at {META_CREDS_PATH}. Skipping Meta Ads sync.")
        return results
        
    try:
        with open(META_CREDS_PATH, 'r') as f:
            creds = json.load(f)
        access_token = creds.get('access_token')
        
        if not access_token:
            logger.warning("Meta access_token not found in credentials file. Skipping Meta Ads sync.")
            return results
            
        api_version = "v20.0"
        insights_url = f"https://graph.facebook.com/{api_version}/{META_AD_ACCOUNT_ID}/insights"
        
        # Request daily breakdown
        params = {
            "level": "campaign",
            "time_increment": 1,  # Get daily stats
            "time_range": json.dumps({"since": start_date_str, "until": end_date_str}),
            "fields": "spend,impressions,clicks,actions",
            "access_token": access_token
        }
        
        response = requests.get(insights_url, params=params)
        data = response.json()
        
        if "error" in data:
            logger.error(f"Meta API Error: {data['error']['message']}")
            return results
            
        for item in data.get("data", []):
            date_str = item.get("date_start")  # YYYY-MM-DD
            spend = float(item.get("spend", 0.0))
            impressions = int(item.get("impressions", 0))
            clicks = int(item.get("clicks", 0))
            actions = item.get("actions", [])
            views = get_action_value(actions, "landing_page_view")
            
            if date_str not in results:
                results[date_str] = {"meta_spend": 0.0, "meta_impressions": 0, "meta_views": 0, "meta_clicks": 0}
                
            results[date_str]["meta_spend"] += spend
            results[date_str]["meta_impressions"] += impressions
            results[date_str]["meta_views"] += views
            results[date_str]["meta_clicks"] += clicks
            
    except Exception as e:
        logger.error(f"Error fetching Meta Ads metrics: {e}")
        
    return results

def sync_data(days=30):
    """Orchestrates syncing all daily metrics for the past N days and updates DB."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    logger.info(f"Starting dashboard sync for range: {start_str} to {end_str}")
    
    # 1. Fetch metrics
    ga4_data = fetch_ga4_metrics(start_str, end_str)
    google_data = fetch_google_ads_metrics(start_str, end_str)
    meta_data = fetch_meta_ads_metrics(start_str, end_str)
    
    # 2. Merge all data points by date
    all_dates = set(ga4_data.keys()) | set(google_data.keys()) | set(meta_data.keys())
    
    logger.info(f"Merging data for {len(all_dates)} days...")
    
    for date_str in sorted(all_dates):
        # Build consolidated metrics dict for this day
        metrics = {
            "sessions": ga4_data.get(date_str, {}).get("sessions", 0),
            "pageviews": ga4_data.get(date_str, {}).get("pageviews", 0),
            "checkouts_initiated": ga4_data.get(date_str, {}).get("checkouts_initiated", 0),
            "new_users": ga4_data.get(date_str, {}).get("new_users", 0),
            "active_users": ga4_data.get(date_str, {}).get("active_users", 0),
            "google_spend": google_data.get(date_str, {}).get("google_spend", 0.0),
            "google_impressions": google_data.get(date_str, {}).get("google_impressions", 0),
            "google_clicks": google_data.get(date_str, {}).get("google_clicks", 0),
            "meta_spend": meta_data.get(date_str, {}).get("meta_spend", 0.0),
            "meta_impressions": meta_data.get(date_str, {}).get("meta_impressions", 0),
            "meta_views": meta_data.get(date_str, {}).get("meta_views", 0),
            "meta_clicks": meta_data.get(date_str, {}).get("meta_clicks", 0),
        }
        
        # Save to database
        save_daily_metric_row(date_str, metrics)
        
    # Update last synced time
    sync_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    save_setting("last_synced_at", sync_time_str)
    logger.info(f"Sync complete at {sync_time_str}!")
    return True

if __name__ == "__main__":
    # Test sync for the last 60 days
    sync_data(days=60)
