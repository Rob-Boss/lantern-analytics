#!/usr/bin/env python3
"""
Google Ads Budget Rollover Script
Queries yesterday's combined Search campaign spend and rolls over any unspent 
portions of the $25.00 daily Search budget to today's Performance Max campaign.
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
        print(f"Yesterday's Search Spend details ({yesterday}):")
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
    
    print("="*60)
    print("RUNNING GOOGLE ADS DYNAMIC BUDGET ROLLOVER")
    print("="*60)

    # 1. Lookup P-Max campaign and budget resource names
    _, pmax_budget_res = get_campaign_details(client, googleads_service, customer_id, pmax_campaign_name)
    if not pmax_budget_res:
        print(f"Error: Could not locate budget details for '{pmax_campaign_name}'")
        sys.exit(1)
        
    # 2. Get yesterday's combined Search spend
    search_daily_cap = 40.00
    yesterday_cost = get_yesterday_spend(client, googleads_service, customer_id, search_campaigns)
    print(f"Combined Search Spend Yesterday: ${yesterday_cost:.2f} (Daily Cap: ${search_daily_cap:.2f})")
    
    # 3. Calculate rollover amount
    rollover = max(0.0, search_daily_cap - yesterday_cost)
    new_pmax_budget = 10.00 + rollover
    
    # Cap P-Max at $30 max to prevent excessive display spend
    new_pmax_budget = min(new_pmax_budget, 30.00)
    
    print(f"Unspent Search Budget: ${rollover:.2f}")
    print(f"Target Performance Max Budget for Today: ${new_pmax_budget:.2f}/day")
    
    # 4. Apply budget change
    update_budget(client, customer_id, pmax_budget_res, new_pmax_budget)
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
