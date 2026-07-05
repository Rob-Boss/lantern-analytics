#!/usr/bin/env python3
"""
Google Ads Budget Rollover Script
Queries yesterday's combined Google Ads spend (Search + Performance Max) 
and rolls over any unspent portions of the $50.00 daily total Google budget 
to today's Search Campaigns Shared Budget, keeping Performance Max locked to $10.00.
"""

import sys
from datetime import date, timedelta
from google.ads.googleads.client import GoogleAdsClient

def get_campaign_details(client, googleads_service, customer_id, campaign_name):
    """Retrieves campaign resource name and its budget resource name."""
    query = f"""
        SELECT 
          campaign.resource_name, 
          campaign.campaign_budget 
        FROM campaign 
        WHERE campaign.name = '{campaign_name}'
        LIMIT 1
    """
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    response = googleads_service.search(request=search_request)
    for row in response:
        return row.campaign.resource_name, row.campaign.campaign_budget
    return None, None

def get_shared_budget_resource(client, googleads_service, customer_id, budget_name):
    """Retrieves shared budget resource name by budget name."""
    query = f"""
        SELECT 
          campaign_budget.resource_name 
        FROM campaign_budget 
        WHERE campaign_budget.name = '{budget_name}'
        LIMIT 1
    """
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    response = googleads_service.search(request=search_request)
    for row in response:
        return row.campaign_budget.resource_name
    return None

def get_yesterday_spend(client, googleads_service, customer_id, campaign_names):
    """Calculates yesterday's combined spend for the specified campaign names."""
    yesterday = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    names_str = ", ".join(f"'{name}'" for name in campaign_names)
    
    query = f"""
        SELECT 
          campaign.name, 
          metrics.cost_micros 
        FROM campaign 
        WHERE campaign.name IN ({names_str})
          AND segments.date = '{yesterday}'
    """
    
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    
    try:
        response = googleads_service.search(request=search_request)
        total_cost = 0.0
        print(f"Yesterday's Spend details ({yesterday}):")
        for row in response:
            cost = row.metrics.cost_micros / 1000000.0
            print(f" - {row.campaign.name}: ${cost:.2f}")
            total_cost += cost
        return total_cost
    except Exception as e:
        print(f"Error querying yesterday's cost: {e}")
        sys.exit(1)

def update_budget(client, customer_id, budget_resource_name, amount_usd):
    """Updates a budget's daily amount in USD."""
    campaign_budget_service = client.get_service("CampaignBudgetService")
    op = client.get_type("CampaignBudgetOperation")
    budget = op.update
    budget.resource_name = budget_resource_name
    budget.amount_micros = int(round(amount_usd, 2) * 1000000)
    op.update_mask.paths.append("amount_micros")
    
    try:
        response = campaign_budget_service.mutate_campaign_budgets(
            customer_id=customer_id, operations=[op]
        )
        print(f"Successfully updated budget to ${amount_usd:.2f}/day: {response.results[0].resource_name}")
    except Exception as e:
        print(f"Failed to update budget: {e}")
        sys.exit(1)

def main():
    try:
        client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load config: {e}")
        sys.exit(1)

    customer_id = str(client.login_customer_id).replace("-", "")
    googleads_service = client.get_service("GoogleAdsService")

    search_campaigns = [
        "Lantern Camp - Search - bottom_of_funnel",
        "Lantern Camp - Search - mid_funnel"
    ]
    pmax_campaign_name = "Lantern Camp - Performance Max - Visual"
    all_campaigns = search_campaigns + [pmax_campaign_name]
    
    print("="*60)
    print("RUNNING GOOGLE ADS DYNAMIC BUDGET ROLLOVER TO SEARCH (COMBINED TOTAL)")
    print("="*60)

    # 1. Lookup campaign and budget resource names
    _, pmax_budget_res = get_campaign_details(client, googleads_service, customer_id, pmax_campaign_name)
    shared_budget_res = get_shared_budget_resource(client, googleads_service, customer_id, "Search Campaigns Shared Budget")
    
    if not pmax_budget_res or not shared_budget_res:
        print("Error: Could not locate budget resource details.")
        sys.exit(1)
        
    # 2. Get yesterday's combined total Google Ads spend
    google_daily_cap = 50.00
    yesterday_cost = get_yesterday_spend(client, googleads_service, customer_id, all_campaigns)
    print(f"Combined Google Ads Spend Yesterday: ${yesterday_cost:.2f} (Total Daily Cap: ${google_daily_cap:.2f})")
    
    # 3. Calculate rollover amount for Search budget
    rollover = max(0.0, google_daily_cap - yesterday_cost)
    new_search_budget = 40.00 + rollover
    
    # Cap Search budget at $50.00 max to keep budgets controlled
    new_search_budget = min(new_search_budget, 50.00)
    
    print(f"Unspent Google Ads Budget (Rollover to Search): ${rollover:.2f}")
    print(f"Target Search Shared Budget for Today: ${new_search_budget:.2f}/day")
    
    # 4. Apply budget changes
    # Update Search Shared Budget dynamically
    update_budget(client, customer_id, shared_budget_res, new_search_budget)
    # Lock Performance Max Budget to the flat $10.00 baseline
    update_budget(client, customer_id, pmax_budget_res, 10.00)
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
