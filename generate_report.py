#!/usr/bin/env python3
"""
Google Ads Performance Report Generator
Queries Google Ads API for performance metrics and outputs a clean report.
"""

import sys
import argparse
from datetime import datetime, date, timedelta
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def get_date_filter(date_range):
    """Translates user input date range to a GAQL filter."""
    date_range = date_range.upper()
    today = date.today()
    
    if ',' in date_range:
        parts = date_range.split(',')
        if len(parts) == 2:
            start = parts[0].strip().replace('-', '')
            end = parts[1].strip().replace('-', '')
            # Format YYYYMMDD to YYYY-MM-DD for consistency
            start_f = f"{start[:4]}-{start[4:6]}-{start[6:]}"
            end_f = f"{end[:4]}-{end[4:6]}-{end[6:]}"
            return f"segments.date >= '{start_f}' AND segments.date <= '{end_f}'", f"{start_f} to {end_f}"
    
    if date_range == "TODAY":
        start_date = today
        end_date = today
        label = "Today"
    elif date_range == "YESTERDAY":
        start_date = today - timedelta(days=1)
        end_date = today - timedelta(days=1)
        label = "Yesterday"
    elif date_range == "LAST_7_DAYS":
        start_date = today - timedelta(days=6)
        end_date = today
        label = "Last 7 Days (Including Today)"
    elif date_range == "LAST_30_DAYS":
        start_date = today - timedelta(days=29)
        end_date = today
        label = "Last 30 Days (Including Today)"
    elif date_range == "THIS_MONTH":
        start_date = today.replace(day=1)
        end_date = today
        label = "This Month"
    elif date_range == "LAST_MONTH":
        first_day_this_month = today.replace(day=1)
        last_day_last_month = first_day_this_month - timedelta(days=1)
        first_day_last_month = last_day_last_month.replace(day=1)
        start_date = first_day_last_month
        end_date = last_day_last_month
        label = "Last Month"
    else:
        # Default to LAST_7_DAYS
        start_date = today - timedelta(days=6)
        end_date = today
        label = "Last 7 Days (Including Today)"
        
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    return f"segments.date >= '{start_str}' AND segments.date <= '{end_str}'", label

def fetch_campaign_metrics(client, customer_id, date_filter):
    """Fetches campaign-level metrics."""
    googleads_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign_budget.amount_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.cost_micros,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversions_value
        FROM campaign
        WHERE {date_filter}
    """
    
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    
    response = googleads_service.search(request=search_request)
    campaigns = []
    for row in response:
        campaign = row.campaign
        budget = row.campaign_budget
        metrics = row.metrics
        
        cost = metrics.cost_micros / 1000000.0
        budget_amt = budget.amount_micros / 1000000.0 if budget.amount_micros else 0.0
        cpa = metrics.cost_per_conversion / 1000000.0 if metrics.cost_per_conversion else 0.0
        
        # Calculate CVR (Conversions / Clicks)
        cvr = (metrics.conversions / metrics.clicks) * 100.0 if metrics.clicks > 0 else 0.0
        
        campaigns.append({
            "id": campaign.id,
            "name": campaign.name,
            "status": campaign.status.name,
            "budget": budget_amt,
            "impressions": metrics.impressions,
            "clicks": metrics.clicks,
            "ctr": metrics.ctr * 100.0, # Convert to percentage
            "cost": cost,
            "conversions": metrics.conversions,
            "cpa": cpa,
            "cvr": cvr,
            "conversion_value": metrics.conversions_value
        })
    return campaigns

def fetch_ad_group_metrics(client, customer_id, date_filter):
    """Fetches ad group-level metrics."""
    googleads_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group.status,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.cost_micros,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversions_value
        FROM ad_group
        WHERE {date_filter}
    """
    
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    
    response = googleads_service.search(request=search_request)
    ad_groups = []
    for row in response:
        campaign = row.campaign
        ad_group = row.ad_group
        metrics = row.metrics
        
        cost = metrics.cost_micros / 1000000.0
        cpa = metrics.cost_per_conversion / 1000000.0 if metrics.cost_per_conversion else 0.0
        cvr = (metrics.conversions / metrics.clicks) * 100.0 if metrics.clicks > 0 else 0.0
        
        ad_groups.append({
            "campaign_name": campaign.name,
            "id": ad_group.id,
            "name": ad_group.name,
            "status": ad_group.status.name,
            "impressions": metrics.impressions,
            "clicks": metrics.clicks,
            "ctr": metrics.ctr * 100.0,
            "cost": cost,
            "conversions": metrics.conversions,
            "cpa": cpa,
            "cvr": cvr,
            "conversion_value": metrics.conversions_value
        })
    return ad_groups

def fetch_keyword_metrics(client, customer_id, date_filter):
    """Fetches keyword-level metrics."""
    googleads_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT
          campaign.name,
          ad_group.name,
          ad_group_criterion.criterion_id,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.cost_micros,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversions_value
        FROM keyword_view
        WHERE {date_filter}
    """
    
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    
    response = googleads_service.search(request=search_request)
    keywords = []
    for row in response:
        campaign = row.campaign
        ad_group = row.ad_group
        criterion = row.ad_group_criterion
        metrics = row.metrics
        
        cost = metrics.cost_micros / 1000000.0
        cpa = metrics.cost_per_conversion / 1000000.0 if metrics.cost_per_conversion else 0.0
        cvr = (metrics.conversions / metrics.clicks) * 100.0 if metrics.clicks > 0 else 0.0
        
        keywords.append({
            "campaign_name": campaign.name,
            "ad_group_name": ad_group.name,
            "id": criterion.criterion_id,
            "text": criterion.keyword.text,
            "match_type": criterion.keyword.match_type.name,
            "status": criterion.status.name,
            "impressions": metrics.impressions,
            "clicks": metrics.clicks,
            "ctr": metrics.ctr * 100.0,
            "cost": cost,
            "conversions": metrics.conversions,
            "cpa": cpa,
            "cvr": cvr,
            "conversion_value": metrics.conversions_value
        })
    return keywords

def format_report_md(customer_id, date_label, campaigns, ad_groups=None, keywords=None):
    """Formats the data as a Markdown report."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Calculate account totals
    total_spend = sum(c['cost'] for c in campaigns)
    total_impressions = sum(c['impressions'] for c in campaigns)
    total_clicks = sum(c['clicks'] for c in campaigns)
    avg_ctr = (total_clicks / total_impressions) * 100.0 if total_impressions > 0 else 0.0
    total_conversions = sum(c['conversions'] for c in campaigns)
    avg_cpa = total_spend / total_conversions if total_conversions > 0 else 0.0
    avg_cvr = (total_conversions / total_clicks) * 100.0 if total_clicks > 0 else 0.0
    total_conv_value = sum(c['conversion_value'] for c in campaigns)
    roas = total_conv_value / total_spend if total_spend > 0 else 0.0
    
    lines = []
    lines.append(f"# Google Ads Performance Report")
    lines.append(f"**Customer ID:** `{customer_id}` | **Date Range:** {date_label} | **Generated At:** {now_str}")
    lines.append("")
    
    lines.append("## 📊 Account Summary")
    lines.append("| Metric | Value |")
    lines.append("| :--- | :--- |")
    lines.append(f"| **Spend (Cost)** | ${total_spend:,.2f} |")
    lines.append(f"| **Impressions** | {total_impressions:,} |")
    lines.append(f"| **Clicks** | {total_clicks:,} |")
    lines.append(f"| **CTR** | {avg_ctr:.2f}% |")
    lines.append(f"| **Conversions** | {total_conversions:,.2f} |")
    lines.append(f"| **Avg. CPA** | ${avg_cpa:,.2f} |")
    lines.append(f"| **Avg. Conversion Rate** | {avg_cvr:.2f}% |")
    lines.append(f"| **Total Conversion Value** | ${total_conv_value:,.2f} |")
    lines.append(f"| **ROAS** | {roas:.2f}x |")
    lines.append("")
    
    lines.append("## 📈 Campaign Performance")
    lines.append("| Campaign Name | Status | Budget | Spend | Clicks | Impr. | CTR | Conv. | CPA | CVR | Value |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for c in campaigns:
        lines.append(
            f"| {c['name']} | `{c['status']}` | ${c['budget']:,.2f} | ${c['cost']:,.2f} | "
            f"{c['clicks']:,} | {c['impressions']:,} | {c['ctr']:.2f}% | {c['conversions']:,.2f} | "
            f"${c['cpa']:,.2f} | {c['cvr']:.2f}% | ${c['conversion_value']:,.2f} |"
        )
    lines.append("")
    
    if ad_groups:
        lines.append("## 👥 Ad Group Performance")
        lines.append("| Campaign Name | Ad Group Name | Status | Spend | Clicks | Impr. | CTR | Conv. | CPA | CVR |")
        lines.append("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
        for ag in ad_groups:
            lines.append(
                f"| {ag['campaign_name']} | {ag['name']} | `{ag['status']}` | ${ag['cost']:,.2f} | "
                f"{ag['clicks']:,} | {ag['impressions']:,} | {ag['ctr']:.2f}% | {ag['conversions']:,.2f} | "
                f"${ag['cpa']:,.2f} | {ag['cvr']:.2f}% |"
            )
        lines.append("")
        
    if keywords:
        lines.append("## 🔑 Top Keyword Performance")
        lines.append("| Ad Group Name | Keyword | Match Type | Status | Spend | Clicks | Impr. | CTR | Conv. | CPA |")
        lines.append("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
        # Sort keywords by clicks descending
        sorted_kw = sorted(keywords, key=lambda x: x['clicks'], reverse=True)
        for kw in sorted_kw[:20]: # Limit to top 20
            lines.append(
                f"| {kw['ad_group_name']} | `{kw['text']}` | {kw['match_type']} | `{kw['status']}` | "
                f"${kw['cost']:,.2f} | {kw['clicks']:,} | {kw['impressions']:,} | {kw['ctr']:.2f}% | "
                f"{kw['conversions']:,.2f} | ${kw['cpa']:,.2f} |"
            )
        lines.append("")
        
    return "\n".join(lines)

def print_report_console(customer_id, date_label, campaigns, ad_groups=None, keywords=None):
    """Prints the report cleanly to stdout."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    total_spend = sum(c['cost'] for c in campaigns)
    total_impressions = sum(c['impressions'] for c in campaigns)
    total_clicks = sum(c['clicks'] for c in campaigns)
    avg_ctr = (total_clicks / total_impressions) * 100.0 if total_impressions > 0 else 0.0
    total_conversions = sum(c['conversions'] for c in campaigns)
    avg_cpa = total_spend / total_conversions if total_conversions > 0 else 0.0
    avg_cvr = (total_conversions / total_clicks) * 100.0 if total_clicks > 0 else 0.0
    total_conv_value = sum(c['conversion_value'] for c in campaigns)
    roas = total_conv_value / total_spend if total_spend > 0 else 0.0

    print("=" * 90)
    print(f"GOOGLE ADS PERFORMANCE REPORT")
    print(f"Customer ID: {customer_id} | Date Range: {date_label} | Generated: {now_str}")
    print("=" * 90)
    print("\n--- ACCOUNT SUMMARY ---")
    print(f"{'Spend (Cost)':<25} : ${total_spend:,.2f}")
    print(f"{'Impressions':<25} : {total_impressions:,}")
    print(f"{'Clicks':<25} : {total_clicks:,}")
    print(f"{'CTR':<25} : {avg_ctr:.2f}%")
    print(f"{'Conversions':<25} : {total_conversions:,.2f}")
    print(f"{'Avg. CPA':<25} : ${avg_cpa:,.2f}")
    print(f"{'Avg. Conversion Rate':<25} : {avg_cvr:.2f}%")
    print(f"{'Total Conversion Value':<25} : ${total_conv_value:,.2f}")
    print(f"{'ROAS':<25} : {roas:.2f}x")
    
    print("\n--- CAMPAIGN PERFORMANCE ---")
    header = f"{'Campaign Name':<35} | {'Status':<8} | {'Spend':<10} | {'Clicks':<6} | {'CTR':<6} | {'Conv.':<6} | {'CPA':<8}"
    print(header)
    print("-" * len(header))
    for c in campaigns:
        print(f"{c['name'][:35]:<35} | {c['status']:<8} | ${c['cost']:<9,.2f} | {c['clicks']:<6,} | {c['ctr']:<5.2f}% | {c['conversions']:<6.2f} | ${c['cpa']:<7,.2f}")
        
    if ad_groups:
        print("\n--- AD GROUP PERFORMANCE ---")
        header_ag = f"{'Ad Group Name':<35} | {'Status':<8} | {'Spend':<10} | {'Clicks':<6} | {'CTR':<6} | {'Conv.':<6} | {'CPA':<8}"
        print(header_ag)
        print("-" * len(header_ag))
        for ag in ad_groups:
            print(f"{ag['name'][:35]:<35} | {ag['status']:<8} | ${ag['cost']:<9,.2f} | {ag['clicks']:<6,} | {ag['ctr']:<5.2f}% | {ag['conversions']:<6.2f} | ${ag['cpa']:<7,.2f}")
            
    if keywords:
        print("\n--- TOP KEYWORDS (BY CLICKS) ---")
        header_kw = f"{'Keyword':<30} | {'Match Type':<12} | {'Spend':<9} | {'Clicks':<6} | {'CTR':<6} | {'Conv.':<5} | {'CPA':<7}"
        print(header_kw)
        print("-" * len(header_kw))
        sorted_kw = sorted(keywords, key=lambda x: x['clicks'], reverse=True)
        for kw in sorted_kw[:15]:
            print(f"{kw['text'][:30]:<30} | {kw['match_type'][:12]:<12} | ${kw['cost']:<8,.2f} | {kw['clicks']:<6,} | {kw['ctr']:<5.2f}% | {kw['conversions']:<5.1f} | ${kw['cpa']:<6,.2f}")
    print("=" * 90)

def main():
    parser = argparse.ArgumentParser(description="Generate Google Ads Performance Report.")
    parser.add_argument(
        "--date-range", 
        default="LAST_7_DAYS",
        help="Date range filter. Predefined values: TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS, THIS_MONTH, LAST_MONTH. Or custom as YYYYMMDD,YYYYMMDD."
    )
    parser.add_argument(
        "--ad-groups", 
        action="store_true",
        help="Include ad group level breakdown in the report."
    )
    parser.add_argument(
        "--keywords", 
        action="store_true",
        help="Include keyword level breakdown in the report."
    )
    parser.add_argument(
        "--output-file", 
        help="Path to save the report as a Markdown file. If omitted, prints to console."
    )
    
    args = parser.parse_args()
    
    # Initialize GoogleAdsClient. Will automatically load configuration from 'google-ads.yaml'
    try:
        googleads_client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        print("Please ensure 'google-ads.yaml' exists and is correctly configured.")
        sys.exit(1)
        
    customer_id = googleads_client.login_customer_id
    if not customer_id or customer_id == "INSERT_LOGIN_CUSTOMER_ID_HERE":
        print("Error: login_customer_id is not configured in 'google-ads.yaml'.")
        sys.exit(1)
        
    cust_id_clean = str(customer_id).replace("-", "")
    
    # Get date filter details
    date_filter_clause, date_label = get_date_filter(args.date_range)
    
    print(f"Querying Google Ads API for Customer ID: {cust_id_clean} ({date_label})...")
    
    try:
        campaigns = fetch_campaign_metrics(googleads_client, cust_id_clean, date_filter_clause)
        
        if not campaigns:
            print("No active campaign data found for the specified date range.")
            sys.exit(0)
            
        ad_groups = None
        if args.ad_groups:
            ad_groups = fetch_ad_group_metrics(googleads_client, cust_id_clean, date_filter_clause)
            
        keywords = None
        if args.keywords:
            keywords = fetch_keyword_metrics(googleads_client, cust_id_clean, date_filter_clause)
            
        if args.output_file:
            report_content = format_report_md(cust_id_clean, date_label, campaigns, ad_groups, keywords)
            with open(args.output_file, 'w') as f:
                f.write(report_content)
            print(f"Report successfully saved to {args.output_file}")
        else:
            print_report_console(cust_id_clean, date_label, campaigns, ad_groups, keywords)
            
    except GoogleAdsException as ex:
        print(
            f"Google Ads API Request with ID '{ex.request_id}' failed with status "
            f"'{ex.error.code().name}' and includes the following errors:"
        )
        for error in ex.failure.errors:
            print(f"\tError code: {error.error_code}")
            print(f"\tError message: {error.message}")
            if error.location:
                for field_path_element in error.location.field_path_elements:
                    print(f"\t\tOn field: {field_path_element.field_name}")
        sys.exit(1)

if __name__ == "__main__":
    main()
