import sys
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def main(client, customer_id):
    """Fetches and prints ad groups from the specified customer ID."""
    googleads_service = client.get_service("GoogleAdsService")
    
    query = """
        SELECT
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group.status
        FROM ad_group
        ORDER BY campaign.name, ad_group.name
    """
    
    print(f"Querying ad groups for Customer ID: {customer_id}...")
    try:
        search_request = client.get_type("SearchGoogleAdsRequest")
        search_request.customer_id = customer_id
        search_request.query = query
        
        response = googleads_service.search(request=search_request)
        
        print("\n" + "-"*80)
        print(f"{'Campaign Name':<30} | {'Ad Group Name':<30} | {'Status':<10}")
        print("-"*80)
        
        count = 0
        for row in response:
            campaign = row.campaign
            ad_group = row.ad_group
            print(f"{campaign.name:<30} | {ad_group.name:<30} | {ad_group.status.name:<10}")
            count += 1
            
        print("-"*80)
        print(f"Total ad groups found: {count}\n")
        
    except GoogleAdsException as ex:
        print(
            f"Request with ID '{ex.request_id}' failed with status "
            f"'{ex.error.code().name}' and includes the following errors:"
        )
        for error in ex.failure.errors:
            print(f"\tError code: {error.error_code}")
            print(f"\tError message: {error.message}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        googleads_client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        sys.exit(1)
        
    customer_id = googleads_client.login_customer_id
    main(googleads_client, str(customer_id).replace("-", ""))
