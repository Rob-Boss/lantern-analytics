#!/usr/bin/env python3
"""
Meta Ads API Live Reporting Tool for Lantern Camp
Fetches campaign summaries, age breakdowns, and geo distributions directly from Meta Graph API.
"""

import os
import sys
import json
import requests
from datetime import datetime

def get_action_value(actions, action_type):
    """Safely extracts the value of a specific action type from the actions list."""
    if not actions:
        return 0
    for action in actions:
        if action.get("action_type") == action_type:
            return int(action.get("value", 0))
    return 0

def main():
    credentials_file = "meta-credentials.json"
    ad_account_id = "act_1585226713251054"
    api_version = "v20.0"
    output_path = "meta_live_report.md"
    
    if not os.path.exists(credentials_file):
        print(f"Error: {credentials_file} not found. Please create it first.", file=sys.stderr)
        sys.exit(1)
        
    try:
        with open(credentials_file, 'r') as f:
            creds = json.load(f)
        access_token = creds['access_token']
    except Exception as e:
        print(f"Error reading credentials: {e}", file=sys.stderr)
        sys.exit(1)
        
    print("Fetching live campaign data from Meta...")
    
    # 1. Fetch Campaigns Overview
    campaigns_url = f"https://graph.facebook.com/{api_version}/{ad_account_id}/campaigns"
    campaigns_params = {
        "fields": "name,status,effective_status",
        "access_token": access_token
    }
    
    try:
        response = requests.get(campaigns_url, params=campaigns_params)
        c_data = response.json()
        if "error" in c_data:
            print(f"Meta API Error: {c_data['error']['message']}", file=sys.stderr)
            sys.exit(1)
            
        campaigns = {c['id']: c for c in c_data.get("data", [])}
        
        # 2. Fetch Lifetime insights per campaign
        insights_url = f"https://graph.facebook.com/{api_version}/{ad_account_id}/insights"
        insights_params = {
            "level": "campaign",
            "fields": "campaign_id,campaign_name,spend,impressions,clicks,actions",
            "date_preset": "maximum",
            "access_token": access_token
        }
        
        i_response = requests.get(insights_url, params=insights_params)
        i_data = i_response.json()
        
        # Map insights to campaigns
        campaign_performance = []
        drive_market_id = None
        
        for ins in i_data.get("data", []):
            c_id = ins.get("campaign_id")
            c_name = ins.get("campaign_name")
            spend = float(ins.get("spend", 0.0))
            impressions = int(ins.get("impressions", 0))
            clicks = int(ins.get("clicks", 0))
            actions = ins.get("actions", [])
            
            # Count Landing Page Views
            lp_views = get_action_value(actions, "landing_page_view")
            
            # Status
            status = campaigns.get(c_id, {}).get("status", "UNKNOWN")
            eff_status = campaigns.get(c_id, {}).get("effective_status", "UNKNOWN")
            
            # Record active Drive Market Campaign ID for breakdowns
            if "Drive Market" in c_name:
                drive_market_id = c_id
                
            campaign_performance.append({
                "id": c_id,
                "name": c_name,
                "status": status,
                "effective_status": eff_status,
                "spend": spend,
                "impressions": impressions,
                "clicks": clicks,
                "lp_views": lp_views
            })
            
        # 3. Query breakdowns for active Drive Market campaign if found
        age_breakdown = []
        geo_breakdown = []
        
        if drive_market_id:
            print(f"Fetching breakdowns for campaign: {drive_market_id}...")
            
            # Age breakdown
            params_age = {
                "level": "campaign",
                "filtering": '[{"field":"campaign.id","operator":"EQUAL","value":"' + drive_market_id + '"}]',
                "breakdowns": "age",
                "fields": "impressions,spend,actions",
                "date_preset": "maximum",
                "access_token": access_token
            }
            age_res = requests.get(insights_url, params=params_age).json()
            for item in age_res.get("data", []):
                age_range = item.get("age")
                if age_range == "Unknown":
                    continue
                actions = item.get("actions", [])
                views = get_action_value(actions, "landing_page_view")
                age_breakdown.append({
                    "age": age_range,
                    "impressions": int(item.get("impressions", 0)),
                    "views": views,
                    "spend": float(item.get("spend", 0.0))
                })
                
            # Geo breakdown
            params_geo = {
                "level": "campaign",
                "filtering": '[{"field":"campaign.id","operator":"EQUAL","value":"' + drive_market_id + '"}]',
                "breakdowns": "region",
                "fields": "impressions,spend",
                "date_preset": "maximum",
                "access_token": access_token
            }
            geo_res = requests.get(insights_url, params=params_geo).json()
            for item in geo_res.get("data", []):
                region = item.get("region")
                if region == "Unknown":
                    continue
                geo_breakdown.append({
                    "state": region,
                    "impressions": int(item.get("impressions", 0)),
                    "spend": float(item.get("spend", 0.0))
                })
                
            # Sort age (logical order) and geo (highest spend first)
            age_breakdown = sorted(age_breakdown, key=lambda x: x['age'])
            geo_breakdown = sorted(geo_breakdown, key=lambda x: x['spend'], reverse=True)

        # 4. Generate Report Markdown
        report_lines = []
        report_lines.append("# 📱 Live Meta Ads Performance Report")
        report_lines.append(f"**Last Queried At:** `{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`")
        report_lines.append("")
        
        report_lines.append("## 📊 Campaign Summary (Lifetime)")
        report_lines.append("| Campaign Name | Status | Spend | Impressions | Clicks | Landing Page Views | Cost per View |")
        report_lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |")
        
        for c in campaign_performance:
            cpv = f"${(c['spend'] / c['lp_views']):.2f}" if c['lp_views'] > 0 else "-"
            report_lines.append(
                f"| **{c['name']}** | `{c['effective_status']}` | ${c['spend']:,.2f} | {c['impressions']:,} | {c['clicks']:,} | {c['lp_views']:,} | {cpv} |"
            )
        report_lines.append("")
        
        if drive_market_id:
            report_lines.append("## 👥 Drive Market Campaign Breakdown")
            
            # Age Table
            report_lines.append("### Age Demographics")
            report_lines.append("| Age Demographic | Impressions | Landing Page Views | Total Spend | Cost per View |")
            report_lines.append("| :--- | :---: | :---: | :---: | :---: |")
            for a in age_breakdown:
                cpv = f"${(a['spend'] / a['views']):.2f}" if a['views'] > 0 else "-"
                report_lines.append(
                    f"| **{a['age']}** | {a['impressions']:,} | {a['views']:,} | ${a['spend']:,.2f} | {cpv} |"
                )
            report_lines.append("")
            
            # Geo Table
            report_lines.append("### Geographic Distribution")
            report_lines.append("| State / Region | Impressions | Spend | % of Budget |")
            report_lines.append("| :--- | :---: | :---: | :---: |")
            total_geo_spend = sum(g['spend'] for g in geo_breakdown)
            for g in geo_breakdown:
                pct = (g['spend'] / total_geo_spend * 100) if total_geo_spend > 0 else 0
                report_lines.append(
                    f"| **{g['state']}** | {g['impressions']:,} | ${g['spend']:,.2f} | {pct:.1f}% |"
                )
            report_lines.append("")
            
        with open(output_path, "w") as f:
            f.write("\n".join(report_lines))
            
        print(f"Success! Live Meta Ads report written to: {output_path}")
        
    except Exception as e:
        print(f"Network error while querying Meta: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
