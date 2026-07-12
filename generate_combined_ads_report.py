#!/usr/bin/env python3
"""
Combined Google & Meta Ads Performance Report Generator
Queries Google Ads API for live performance, reads Meta Ads performance from meta_live_report.md,
and generates a combined markdown report for the user.
"""

import os
import sys
import argparse
from datetime import datetime, date, timedelta
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def get_last_30_days_filter():
    """Returns GAQL filter for the last 30 days (including today)."""
    today = date.today()
    start_date = today - timedelta(days=29)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = today.strftime("%Y-%m-%d")
    return f"segments.date >= '{start_str}' AND segments.date <= '{end_str}'", f"{start_str} to {end_str}"

def fetch_google_campaigns(client, customer_id, date_filter):
    """Fetches campaign-level metrics from Google Ads."""
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
        cvr = (metrics.conversions / metrics.clicks) * 100.0 if metrics.clicks > 0 else 0.0
        
        campaigns.append({
            "name": campaign.name,
            "status": campaign.status.name,
            "budget": budget_amt,
            "impressions": metrics.impressions,
            "clicks": metrics.clicks,
            "ctr": metrics.ctr * 100.0,
            "cost": cost,
            "conversions": metrics.conversions,
            "cpa": cpa,
            "cvr": cvr,
            "conversion_value": metrics.conversions_value
        })
    return campaigns

def parse_meta_report(filepath):
    """Parses Meta Ads tables from meta_live_report.md."""
    campaigns = []
    age_breakdown = []
    geo_breakdown = []
    
    if not os.path.exists(filepath):
        print(f"Warning: {filepath} not found. Meta Ads details will be skipped or read from input JSON.", file=sys.stderr)
        return None, None, None
        
    current_section = None
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            if line.startswith("## 📊 Campaign Summary"):
                current_section = "campaigns"
                continue
            elif line.startswith("### Age Demographics"):
                current_section = "age"
                continue
            elif line.startswith("### Geographic Distribution"):
                current_section = "geo"
                continue
            elif line.startswith("##") or line.startswith("#"):
                current_section = None
                continue
                
            if current_section == "campaigns" and line.startswith("|") and not line.startswith("| Campaign Name") and not line.startswith("| :---"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                if len(parts) >= 7:
                    name = parts[0].replace("**", "")
                    status = parts[1].replace("`", "")
                    spend = float(parts[2].replace("$", "").replace(",", ""))
                    impressions = int(parts[3].replace(",", ""))
                    clicks = int(parts[4].replace(",", ""))
                    # Safe parse Landing Page Views
                    views_str = parts[5].replace(",", "")
                    views = int(views_str) if views_str and views_str != "-" else 0
                    campaigns.append({
                        "name": name,
                        "status": status,
                        "spend": spend,
                        "impressions": impressions,
                        "clicks": clicks,
                        "views": views
                    })
            elif current_section == "age" and line.startswith("|") and not line.startswith("| Age Demographic") and not line.startswith("| :---"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                if len(parts) >= 5:
                    age = parts[0].replace("**", "")
                    impressions = int(parts[1].replace(",", ""))
                    views = int(parts[2].replace(",", ""))
                    spend = float(parts[3].replace("$", "").replace(",", ""))
                    age_breakdown.append({
                        "age": age,
                        "impressions": impressions,
                        "views": views,
                        "spend": spend
                    })
            elif current_section == "geo" and line.startswith("|") and not line.startswith("| State / Region") and not line.startswith("| :---"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                if len(parts) >= 4:
                    state = parts[0].replace("**", "")
                    impressions = int(parts[1].replace(",", ""))
                    spend = float(parts[2].replace("$", "").replace(",", ""))
                    pct = float(parts[3].replace("%", ""))
                    geo_breakdown.append({
                        "state": state,
                        "impressions": impressions,
                        "spend": spend,
                        "percent": pct
                    })
    return campaigns, age_breakdown, geo_breakdown

def main():
    parser = argparse.ArgumentParser(description="Generate Combined Google and Meta Ads Performance Report.")
    parser.add_argument("--output-file", default="combined_ads_performance_report.md")
    parser.add_argument("--artifact-file", default="")
    args = parser.parse_args()
    
    # 1. Fetch Google Ads
    print("Loading Google Ads client...")
    try:
        googleads_client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load Google Ads config: {e}")
        sys.exit(1)
        
    customer_id = googleads_client.login_customer_id
    cust_id_clean = str(customer_id).replace("-", "")
    date_filter_clause, date_label = get_last_30_days_filter()
    
    print(f"Querying Google Ads API for Customer ID: {cust_id_clean} ({date_label})...")
    try:
        google_campaigns = fetch_google_campaigns(googleads_client, cust_id_clean, date_filter_clause)
    except GoogleAdsException as ex:
        print(f"Google Ads API Error: {ex}")
        google_campaigns = []
        
    # 2. Fetch Meta Ads (from meta_live_report.md)
    print("Parsing Meta Ads live report cache...")
    meta_campaigns, meta_age, meta_geo = parse_meta_report("meta_live_report.md")
    
    # Fallback to json if file parsing failed or returned empty campaigns
    if not meta_campaigns:
        print("Using meta_ads_input.json fallback...")
        if os.path.exists("meta_ads_input.json"):
            with open("meta_ads_input.json", 'r') as f:
                meta_json = json.load(f)
                meta_campaigns = []
                for c in meta_json.get("campaigns", []):
                    meta_campaigns.append({
                        "name": c["name"],
                        "status": c["status"],
                        "spend": c["spend"],
                        "impressions": c["impressions"],
                        "clicks": c["clicks"],
                        "views": c.get("views", c["clicks"]) # Landing page views default to clicks
                    })
                meta_age = meta_json.get("age_breakdown", [])
                meta_geo = meta_json.get("geo_breakdown", [])
                
    # 3. Combine stats
    g_spend = sum(c['cost'] for c in google_campaigns)
    g_impressions = sum(c['impressions'] for c in google_campaigns)
    g_clicks = sum(c['clicks'] for c in google_campaigns)
    
    m_spend = sum(c['spend'] for c in meta_campaigns) if meta_campaigns else 0.0
    m_impressions = sum(c['impressions'] for c in meta_campaigns) if meta_campaigns else 0
    m_clicks = sum(c['clicks'] for c in meta_campaigns) if meta_campaigns else 0
    m_views = sum(c['views'] for c in meta_campaigns) if meta_campaigns else 0
    
    total_spend = g_spend + m_spend
    total_impressions = g_impressions + m_impressions
    total_clicks = g_clicks + m_clicks
    
    g_ctr = (g_clicks / g_impressions * 100.0) if g_impressions > 0 else 0.0
    m_ctr = (m_clicks / m_impressions * 100.0) if m_impressions > 0 else 0.0
    combined_ctr = (total_clicks / total_impressions * 100.0) if total_impressions > 0 else 0.0
    
    g_cpc = (g_spend / g_clicks) if g_clicks > 0 else 0.0
    m_cpc = (m_spend / m_clicks) if m_clicks > 0 else 0.0
    m_cpv = (m_spend / m_views) if m_views > 0 else 0.0
    combined_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0.0
    
    # 4. Generate Combined Report Markdown
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = []
    lines.append("# 📊 Combined Advertising Performance Report")
    lines.append(f"**Generated At:** `{now_str}` | **Date Range:** Last 30 Days (Including Today)")
    lines.append("")
    lines.append("> [!NOTE]")
    lines.append("> **Note on Data Sources:** Google Ads data is queried in real-time from the Google Ads API. Meta Ads data is populated from the latest campaign snapshots (lifetime totals as of June 28, 2026, when the account reached its budget limit).")
    lines.append("")
    
    lines.append("## 📈 Advertising Channels Overview")
    lines.append("| Channel | Spend | Impressions | Clicks / Views | CTR | Avg. CPC / CPV |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")
    lines.append(f"| **Google Ads** | ${g_spend:,.2f} | {g_impressions:,} | {g_clicks:,} clicks | {g_ctr:.2f}% | ${g_cpc:.2f} CPC |")
    lines.append(f"| **Meta Ads** | ${m_spend:,.2f} | {m_impressions:,} | {m_views:,} views | {m_ctr:.2f}% | ${m_cpv:.2f} CPV |")
    lines.append(f"| **Combined** | **${total_spend:,.2f}** | **{total_impressions:,}** | **{total_clicks:,} clicks** | **{combined_ctr:.2f}%** | **${combined_cpc:.2f} CPC** |")
    lines.append("")
    
    lines.append("## 🔍 Google Ads Campaign Details")
    lines.append("| Campaign Name | Status | Budget | Spend | Clicks | Impressions | CTR | Conversions | Value |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for c in google_campaigns:
        lines.append(
            f"| {c['name']} | `{c['status']}` | ${c['budget']:,.2f} | ${c['cost']:,.2f} | "
            f"{c['clicks']:,} | {c['impressions']:,} | {c['ctr']:.2f}% | {c['conversions']:,.2f} | ${c['conversion_value']:,.2f} |"
        )
    lines.append("")
    
    lines.append("## 📱 Meta Ads Campaign Details")
    lines.append("| Campaign Name | Status | Spend | Impressions | Clicks | Landing Page Views | Cost per View |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |")
    for c in meta_campaigns:
        cpv = f"${(c['spend'] / c['views']):.2f}" if c['views'] > 0 else "-"
        lines.append(
            f"| **{c['name']}** | `{c['status']}` | ${c['spend']:,.2f} | {c['impressions']:,} | {c['clicks']:,} | {c['views']:,} | {cpv} |"
        )
    lines.append("")
    
    if meta_age:
        lines.append("### Meta Demographics (Drive Market Campaign)")
        lines.append("| Age Demographic | Impressions | Landing Page Views | Total Spend | Cost per View |")
        lines.append("| :--- | :---: | :---: | :---: | :---: |")
        for a in meta_age:
            cpv = f"${(a['spend'] / a['views']):.2f}" if a['views'] > 0 else "-"
            # age label might be age range or a dict
            age_val = a.get("age", "Unknown")
            lines.append(
                f"| **{age_val}** | {a['impressions']:,} | {a['views']:,} | ${a['spend']:,.2f} | {cpv} |"
            )
        lines.append("")
        
    if meta_geo:
        lines.append("### Meta Geographic Distribution (Drive Market Campaign)")
        lines.append("| State / Region | Impressions | Spend | % of Budget |")
        lines.append("| :--- | :---: | :---: | :---: |")
        total_geo_spend = sum(g.get('spend', 0.0) for g in meta_geo)
        for g in meta_geo:
            pct = g.get('percent')
            if pct is None:
                pct = (g.get('spend', 0.0) / total_geo_spend * 100) if total_geo_spend > 0 else 0.0
            lines.append(
                f"| **{g.get('state', 'Unknown')}** | {g.get('impressions', 0):,} | ${g.get('spend', 0.0):,.2f} | {pct:.1f}% |"
            )
        lines.append("")
        
    lines.append("## 💡 Key Strategic Observations")
    lines.append(f"1. **Cost & Engagement Divergence:** Google Ads have an average CPC of **${g_cpc:.2f}**, compared to Meta's cost per Landing Page View of **${m_cpv:.2f}**. Google Search Ads boast a **{g_ctr:.2f}% click-through rate** compared to Meta's **{m_ctr:.2f}%**, highlighting the high search intent of the Google audience.")
    
    # Check status of Meta Drive Market campaign
    drive_market_active = any(c['status'] == 'ACTIVE' for c in meta_campaigns if '[Drive Market]' in c['name'])
    if drive_market_active:
        lines.append(f"2. **Meta Traffic Active:** Meta campaigns are active, with a lifetime spend of **${m_spend:,.2f}**. The main [Drive Market] campaign is running and driving consistent, cost-effective traffic (~${m_cpv:.2f} per landing page view).")
    else:
        lines.append(f"2. **Meta Traffic Paused:** The Meta campaigns have spent a total of **${m_spend:,.2f}** and are currently paused due to reaching the ad account budget limit or being turned off.")
        
    google_conv = sum(c['conversions'] for c in google_campaigns)
    lines.append(f"3. **Google Intent Targeting:** The Google Ads campaigns are active and have spent **${g_spend:,.2f}** over the last 30 days. Google Ads reports **{google_conv:.2f}** conversions directly. Note that GA4 has recorded a conversion of **$251.10** from `google / cpc` on July 9, which highlights the need to link GA4 and Google Ads to sync these conversions.")
    lines.append("")
    
    report_content = "\n".join(lines)
    
    # Save to local file
    try:
        with open(args.output_file, 'w') as f:
            f.write(report_content)
        print(f"Report successfully saved to {args.output_file}")
    except Exception as e:
        print(f"Error saving report to {args.output_file}: {e}")
        
    # Save to artifact path if specified
    if args.artifact_file:
        try:
            # Ensure directories exist
            os.makedirs(os.path.dirname(args.artifact_file), exist_ok=True)
            with open(args.artifact_file, 'w') as f:
                f.write(report_content)
            print(f"Report successfully saved to artifact: {args.artifact_file}")
        except Exception as e:
            print(f"Error saving report to artifact {args.artifact_file}: {e}")

if __name__ == "__main__":
    main()
