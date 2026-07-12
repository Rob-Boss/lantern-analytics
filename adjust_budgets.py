#!/usr/bin/env python3
"""
Lantern Camp Google Ads Budget Adjuster Utility
Updates Google Ads budgets dynamically from command line arguments.
Usage:
  .venv/bin/python adjust_budgets.py --search-budget 45.00 --pmax-budget 5.00
"""

import sys
import argparse
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def get_campaign_info(client, googleads_service, customer_id, campaign_name):
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

def update_budget_amount(client, customer_id, budget_resource, amount_usd):
    """Mutates a daily campaign budget amount."""
    campaign_budget_service = client.get_service("CampaignBudgetService")
    op = client.get_type("CampaignBudgetOperation")
    budget = op.update
    budget.resource_name = budget_resource
    budget.amount_micros = int(amount_usd * 1000000)
    op.update_mask.paths.append("amount_micros")
    
    print(f"Updating budget {budget_resource} to ${amount_usd:.2f}/day...")
    response = campaign_budget_service.mutate_campaign_budgets(
        customer_id=customer_id, operations=[op]
    )
    print(f"Successfully mutated budget: {response.results[0].resource_name}")

def main():
    parser = argparse.ArgumentParser(description="Adjust Google Ads Budgets for Lantern Camp.")
    parser.add_argument("--search-budget", type=float, help="Daily budget for Search Campaigns Shared Budget (in USD)")
    parser.add_argument("--pmax-budget", type=float, help="Daily budget for Performance Max Visual campaign (in USD)")
    args = parser.parse_args()
    
    if args.search_budget is None and args.pmax_budget is None:
        parser.print_help()
        sys.exit(1)
        
    try:
        client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        sys.exit(1)
        
    customer_id = str(client.login_customer_id).replace("-", "")
    googleads_service = client.get_service("GoogleAdsService")
    
    # Campaign/Budget resource lookup
    pmax_campaign = "Lantern Camp - Performance Max - Visual"
    _, pmax_budget_res = get_campaign_info(client, googleads_service, customer_id, pmax_campaign)
    shared_budget_res = get_shared_budget_resource(client, googleads_service, customer_id, "Search Campaigns Shared Budget")
    
    try:
        if args.search_budget is not None:
            if not shared_budget_res:
                print("Error: Could not locate Search Campaigns Shared Budget resource.")
            else:
                update_budget_amount(client, customer_id, shared_budget_res, args.search_budget)
                
        if args.pmax_budget is not None:
            if not pmax_budget_res:
                print(f"Error: Could not locate budget for {pmax_campaign}.")
            else:
                update_budget_amount(client, customer_id, pmax_budget_res, args.pmax_budget)
                
        print("\nBudget updates applied successfully!")
        
    except GoogleAdsException as ex:
        print(f"\nGoogle Ads API Error:")
        print(f"Request ID: {ex.request_id}")
        for error in ex.failure.errors:
            print(f"\tError code: {error.error_code}")
            print(f"\tError message: {error.message}")
        sys.exit(1)

if __name__ == "__main__":
    main()
