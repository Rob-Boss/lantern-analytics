#!/usr/bin/env python3
"""
Lantern Camp Google Ads Negatives Applier Utility
Adds competitor phrase-match negative keywords to Search campaigns.
"""

import sys
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def get_campaign_resource(client, googleads_service, customer_id, campaign_name):
    """Retrieves campaign resource name."""
    query = f"""
        SELECT 
          campaign.resource_name
        FROM campaign 
        WHERE campaign.name = '{campaign_name}'
        LIMIT 1
    """
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    response = googleads_service.search(request=search_request)
    for row in response:
        return row.campaign.resource_name
    return None

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

def main():
    negatives = [
        "sandy pines",
        "huttopia",
        "fortland",
        "woods of eden",
        "salt cottages"
    ]
    
    try:
        client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        sys.exit(1)
        
    customer_id = str(client.login_customer_id).replace("-", "")
    googleads_service = client.get_service("GoogleAdsService")
    
    campaign_names = [
        "Lantern Camp - Search - bottom_of_funnel",
        "Lantern Camp - Search - mid_funnel"
    ]
    
    try:
        for name in campaign_names:
            campaign_res = get_campaign_resource(client, googleads_service, customer_id, name)
            if not campaign_res:
                print(f"Error: Could not locate campaign '{name}'. Skipping.")
                continue
            add_campaign_negatives(client, customer_id, campaign_res, negatives)
            
        print("\nAll competitor negative keywords added successfully!")
        
    except GoogleAdsException as ex:
        print(f"\nGoogle Ads API Error:")
        print(f"Request ID: {ex.request_id}")
        for error in ex.failure.errors:
            print(f"\tError code: {error.error_code}")
            print(f"\tError message: {error.message}")
        sys.exit(1)

if __name__ == "__main__":
    main()
