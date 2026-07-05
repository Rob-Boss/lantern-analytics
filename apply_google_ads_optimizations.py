import sys
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

def get_ad_group_resource(client, googleads_service, customer_id, campaign_resource, ad_group_name):
    """Retrieves ad group resource name by campaign and ad group name."""
    query = f"""
        SELECT 
          ad_group.resource_name 
        FROM ad_group 
        WHERE ad_group.campaign = '{campaign_resource}' 
          AND ad_group.name = '{ad_group_name}'
        LIMIT 1
    """
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    response = googleads_service.search(request=search_request)
    for row in response:
        return row.ad_group.resource_name
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

def add_campaign_negatives(client, customer_id, campaign_resource, negative_texts):
    """Adds campaign negative criteria to prevent competitor clicks."""
    campaign_criterion_service = client.get_service("CampaignCriterionService")
    operations = []
    
    for text in negative_texts:
        op = client.get_type("CampaignCriterionOperation")
        criterion = op.create
        criterion.campaign = campaign_resource
        criterion.negative = True
        criterion.keyword.text = text
        criterion.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
        operations.append(op)
        
    print(f"Adding negative keywords to campaign {campaign_resource}...")
    response = campaign_criterion_service.mutate_campaign_criteria(
        customer_id=customer_id, operations=operations
    )
    print(f"Successfully added {len(response.results)} negative keywords.")

def add_ad_group_keywords(client, customer_id, ad_group_resource, keyword_texts):
    """Adds phrase match keywords to the targeted ad group."""
    ad_group_criterion_service = client.get_service("AdGroupCriterionService")
    operations = []
    
    for text in keyword_texts:
        op = client.get_type("AdGroupCriterionOperation")
        criterion = op.create
        criterion.ad_group = ad_group_resource
        criterion.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        criterion.keyword.text = text
        criterion.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
        operations.append(op)
        
    print(f"Adding phrase match keywords to ad group {ad_group_resource}...")
    response = ad_group_criterion_service.mutate_ad_group_criteria(
        customer_id=customer_id, operations=operations
    )
    print(f"Successfully added {len(response.results)} keywords.")

def main():
    try:
        client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        sys.exit(1)
        
    customer_id = str(client.login_customer_id).replace("-", "")
    googleads_service = client.get_service("GoogleAdsService")
    
    # 1. Campaigns info
    bof_campaign = "Lantern Camp - Search - bottom_of_funnel"
    mof_campaign = "Lantern Camp - Search - mid_funnel"
    pmax_campaign = "Lantern Camp - Performance Max - Visual"
    
    bof_res, _ = get_campaign_info(client, googleads_service, customer_id, bof_campaign)
    mof_res, _ = get_campaign_info(client, googleads_service, customer_id, mof_campaign)
    pmax_res, pmax_budget_res = get_campaign_info(client, googleads_service, customer_id, pmax_campaign)
    
    # 2. Shared budget info
    shared_budget_res = get_shared_budget_resource(client, googleads_service, customer_id, "Search Campaigns Shared Budget")
    
    if not shared_budget_res or not pmax_budget_res:
        print("Error: Could not locate budget resources.")
        sys.exit(1)
        
    try:
        # Step A: Update budgets (Resetting to static base budgets)
        update_budget_amount(client, customer_id, shared_budget_res, 40.00)
        update_budget_amount(client, customer_id, pmax_budget_res, 10.00)
        
        # Step B: Add campaign-level negative keywords (Completed in previous run)
        # negatives = ["under canvas", "terramor", "ferncrest", "acadia yurts"]
        # if bof_res:
        #     add_campaign_negatives(client, customer_id, bof_res, negatives)
        # if mof_res:
        #     add_campaign_negatives(client, customer_id, mof_res, negatives)
            
        # Step C: Add keywords to mid-funnel ad group "Regional Glamping & Nature Lodging" (Completed in previous run)
        # if mof_res:
        #     ad_group_res = get_ad_group_resource(client, googleads_service, customer_id, mof_res, "Regional Glamping & Nature Lodging")
        #     if ad_group_res:
        #         new_keywords = [
        #             "acadia glamping",
        #             "luxury glamping maine",
        #             "maine glamping cabin rentals",
        #             "camping cabins near acadia",
        #             "luxury camping maine"
        #         ]
        #         add_ad_group_keywords(client, customer_id, ad_group_res, new_keywords)
        #     else:
        #         print("Error: Could not find ad group 'Regional Glamping & Nature Lod'")
                 
        print("\nAll Google Ads budgets reset successfully!")
        
    except GoogleAdsException as ex:
        print(f"\nGoogle Ads API Error:")
        print(f"Request ID: {ex.request_id}")
        for error in ex.failure.errors:
            print(f"\tError code: {error.error_code}")
            print(f"\tError message: {error.message}")
        sys.exit(1)

if __name__ == "__main__":
    main()
