#!/usr/bin/env python3
"""
Lantern Camp Unified Traffic Performance Report Generator
Queries GA4 and Google Ads to compile a phase-by-phase traffic impact report.
"""

import os
import sys
import json
from datetime import datetime, date
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest,
    DateRange,
    Metric,
    Dimension,
)

def get_phase_stats(daily_data, start_date, end_date):
    """Calculates average daily sessions and users for a specific date range."""
    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    total_sessions = 0
    total_users = 0
    days = 0
    
    for date_str, metrics in daily_data.items():
        curr_dt = datetime.strptime(date_str, "%Y%m%d").date()
        if start_dt <= curr_dt <= end_dt:
            total_sessions += metrics['sessions']
            total_users += metrics['users']
            days += 1
            
    avg_sessions = total_sessions / days if days > 0 else 0
    avg_users = total_users / days if days > 0 else 0
    return {
        "avg_sessions": avg_sessions,
        "avg_users": avg_users,
        "total_sessions": total_sessions,
        "days": days
    }

def generate_ascii_bar(val, max_val, max_bar_length=40):
    """Generates an ASCII bar representing a value relative to a maximum value."""
    if max_val == 0:
        return ""
    bar_len = int((val / max_val) * max_bar_length)
    return "█" * max(1, bar_len)

def main():
    google_ads_yaml = "google-ads.yaml"
    ga4_credentials_json = "ga4-credentials.json"
    ga4_property_id = "534706583"
    meta_input_json = "meta_ads_input.json"
    output_path = "performance_report_today.md"
    
    print("Initializing Google Analytics API...")
    try:
        ga4_client = BetaAnalyticsDataClient.from_service_account_json(ga4_credentials_json)
    except Exception as e:
        print(f"Error loading GA4 credentials: {e}")
        sys.exit(1)
        
    # 1. Fetch daily traffic data from May 1 to today
    today_str = date.today().strftime("%Y-%m-%d")
    print(f"Querying GA4 daily traffic from 2026-05-01 to {today_str}...")
    
    daily_traffic = {}
    try:
        request = RunReportRequest(
            property=f"properties/{ga4_property_id}",
            date_ranges=[DateRange(start_date="2026-05-01", end_date=today_str)],
            dimensions=[Dimension(name="date")],
            metrics=[Metric(name="sessions"), Metric(name="activeUsers")]
        )
        response = ga4_client.run_report(request)
        for row in response.rows:
            dt = row.dimension_values[0].value
            sessions = int(row.metric_values[0].value)
            users = int(row.metric_values[1].value)
            daily_traffic[dt] = {"sessions": sessions, "users": users}
    except Exception as e:
        print(f"Error fetching GA4 traffic: {e}")
        sys.exit(1)
        
    # Define phase boundaries
    phases = [
        {"name": "Phase 0: Baseline (No Ads)", "start": "2026-05-01", "end": "2026-06-10", "activity": "Word of mouth / natural traffic", "spend": 0.0, "source": "None", "cpc": "-", "budget": "-"},
        {"name": "Phase 1: First Meta Ads", "start": "2026-06-11", "end": "2026-06-20", "activity": "Meta Campaign 1 (Homepage Traffic)", "spend": 179.56, "source": "Meta Ads", "cpc": "$0.18", "budget": "$50.00/day"},
        {"name": "Phase-2: Optimized Meta Ads", "start": "2026-06-21", "end": "2026-06-24", "activity": "Meta Campaign 1b (Drive Market Traffic)", "spend": 269.41, "source": "Meta Ads", "cpc": "$0.14", "budget": "$50.00/day"},
        {"name": "Phase 3: Google Search Launch", "start": "2026-06-25", "end": "2026-06-26", "activity": "Google Brand Protection + Mid-Funnel Search", "spend": 42.57, "source": "Google Search", "cpc": "$1.09", "budget": "$20.00/day"}
    ]
    
    # Calculate stats per phase
    max_avg_sessions = 0
    for p in phases:
        stats = get_phase_stats(daily_traffic, p['start'], p['end'])
        p.update(stats)
        if stats['avg_sessions'] > max_avg_sessions:
            max_avg_sessions = stats['avg_sessions']
            
    # Build Markdown Report
    lines = []
    lines.append("# 📊 Lantern Camp Website Traffic Report")
    lines.append(f"**Created At:** `{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}` | **Target Audience:** Summary View")
    lines.append("")
    lines.append("This report traces how our marketing efforts have directly grown traffic to `lanterncamp.com` and `app.mews.com` since launching campaigns in June.")
    lines.append("")
    
    # Section 1: Visual Timeline
    lines.append("## 📈 Traffic Growth Timeline (Average Daily Sessions)")
    lines.append("```text")
    for p in phases:
        bar = generate_ascii_bar(p['avg_sessions'], max_avg_sessions, max_bar_length=45)
        # Pad name for clean alignment
        # Handle the custom Phase-2 split
        name_clean = p['name'].replace("Phase-2", "Phase 2")
        name_padded = f"{name_clean[:30]:<30}"
        lines.append(f"{name_padded} | {bar} ({p['avg_sessions']:.0f} daily sessions)")
    lines.append("```")
    lines.append("")
    
    # Section 1b: Recent Traffic Detail
    lines.append("### Meta Campaign Recent Detail (Daily Website Views)")
    lines.append("This snapshot shows the daily traffic pattern leading up to the pause when the account hit its spending limit:")
    lines.append("```text")
    lines.append("June 24 | █████████████████████████████████ (3,381 views)")
    lines.append("June 25 | ███████████████████████████████████ (3,569 views)")
    lines.append("June 26 | █████████████████████████████████████████ (4,107 views) [Peak]")
    lines.append("June 27 | █████ (536 views) [Ad Spend Limit Reached]")
    lines.append("June 28 | ██ (206 views) [Partial Day]")
    lines.append("```")
    lines.append("")
    
    # Section 2: Phase Breakdown Table
    lines.append("## 📁 Phase-by-Phase Performance")
    lines.append("| Marketing Phase | Date Range | Primary Activity | Avg. Daily Sessions | Daily Budget | Total Spend | Ad Cost per Click / View |")
    lines.append("| :--- | :--- | :--- | :---: | :---: | :---: | :---: |")
    for p in phases:
        name_clean = p['name'].replace("Phase-2", "Phase 2")
        lines.append(
            f"| **{name_clean.split(':')[1].strip()}** | {p['start']} to {p['end']} | {p['activity']} | **{p['avg_sessions']:.0f}** | {p['budget']} | ${p['spend']:,.2f} | {p['cpc']} |"
        )
    lines.append("")
    
    # Section 3: Value of a Click (The Core Strategy)
    lines.append("## 🔑 Traffic Value: Quality vs. Quantity")
    lines.append("Not all web traffic is created equal. A cheaper click is not always the best business value. Here is why:")
    lines.append("")
    
    lines.append("> [!TIP]")
    lines.append("> ### 📱 Meta Ads (Social Volume)")
    lines.append("> * **Cost:** Cheap (~$0.14 - $0.18 per landing page view)")
    lines.append("> * **Behavior:** Users on Instagram/Facebook are browsing social media; they aren't actively looking to book a cabin. This generates a **high volume of views** but requires more nurturing to turn into a booking.")
    lines.append("> * **Value:** Great for building brand awareness and filling the top of the funnel.")
    lines.append("")
    
    lines.append("> [!IMPORTANT]")
    lines.append("> ### 🔍 Google Ads (High-Intent Search)")
    lines.append("> * **Cost:** More expensive (~$1.09 per session)")
    lines.append("> * **Behavior:** Users on Google Search are actively typing keywords like `\"glamping near acadia\"` or `\"cabins near bar harbor\"`. They are in an **active planning and buying mindset**.")
    lines.append("> * **Value:** Extremely high value. Even though we pay more per click, these visitors are pre-qualified and significantly more likely to convert directly into guests.")
    lines.append("")
    
    # Section 4: Current Status & Observations
    lines.append("## ⚠️ Key Insights & Observations")
    lines.append("> [!NOTE]")
    lines.append("> ### 1. Meta Ads Audience & Geo Distribution")
    lines.append("> * **Age Profile:** **37% of our active Meta spend** goes to the **65+ age demographic**.")
    lines.append("> * **Geo Profile:** **21% of our active Meta spend** is concentrated locally within **Maine** (primarily Cumberland County and York County).")
    lines.append("")
    
    # Section 5: What's Next
    lines.append("## 🚀 What's Next")
    lines.append("> ### 1. Demographic Retention Strategy (65+)")
    lines.append("> For our top-of-funnel traffic campaigns, we will **maintain targeting for the 65+ group**. At $0.14 per view, they are highly cost-effective and act as a strong brand awareness engine (frequently sharing details with family and children). When we transition to conversion-focused campaigns in the next phase, we can apply stricter age restrictions.")
    lines.append("")
    lines.append("> ### 2. Local Maine Spontaneous Travel Focus")
    lines.append("> We will **continue targeting local Mainers** in Cumberland and York counties, and **recommend adding Knox County (Camden)** to the targeting list. Because we need last-minute bookings right now, local travelers are our highest-intent audience: a Mainer is far more likely to book a spontaneous weekend trip to Blue Hill/Orland than a Boston traveler who planned their Acadia trip months ago.")
    lines.append("")
    lines.append("> ### 3. Resumed Campaign Traffic (Limit Raised)")
    lines.append("> Now that GA4 and GTM booking tracking are fully active and validated, we have increased the monthly spending limit and resumed campaign traffic to begin tracking direct conversion and purchase data.")
    lines.append("")
    lines.append("> ### 4. Launching Retargeting & Visual Campaigns")
    lines.append("> Since we have established a strong baseline of traffic, we will expand into **visual remarketing/retargeting** next:")
    lines.append("> * **Google Visual Campaign (Performance Max):** We will build visual image/video ads to run across YouTube, Display, and Maps. We will seed this campaign with our website visitor data as an audience signal to retarget past visitors and find similar travelers.")
    lines.append("> * **Meta Custom Audience Retargeting:** We will create a dedicated ad set targeting past website visitors (past 30 days) who did not complete a booking, showing them high-differentiator creatives (cabin interiors, cedarwood sauna, dog-friendly highlights) to prompt a return visit and booking.")
    lines.append("")
    
    # Save output
    try:
        with open(output_path, 'w') as f:
            f.write("\n".join(lines))
        print(f"New unified traffic report saved to {output_path}!")
    except Exception as e:
        print(f"Error saving report: {e}")

if __name__ == "__main__":
    main()
