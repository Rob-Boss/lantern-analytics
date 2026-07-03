import sys
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def main(client, customer_id):
    """Fetches and prints campaigns from the specified customer ID."""
    googleads_service = client.get_service("GoogleAdsService")
    
    # Simple GAQL query to list campaigns
    query = """
        SELECT
          campaign.id,
          campaign.name,
          campaign.status
        FROM campaign
        ORDER BY campaign.name
    """
    
    print(f"Querying campaigns for Customer ID: {customer_id}...")
    try:
        search_request = client.get_type("SearchGoogleAdsRequest")
        search_request.customer_id = customer_id
        search_request.query = query
        
        response = googleads_service.search(request=search_request)
        
        print("\n" + "-"*40)
        print(f"{'Campaign ID':<15} | {'Campaign Name':<25} | {'Status':<10}")
        print("-"*40)
        
        count = 0
        for row in response:
            campaign = row.campaign
            print(f"{campaign.id:<15} | {campaign.name:<25} | {campaign.status.name:<10}")
            count += 1
            
        print("-"*40)
        print(f"Total campaigns found: {count}\n")
        
    except GoogleAdsException as ex:
        print(
            f"Request with ID '{ex.request_id}' failed with status "
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
    # Initialize GoogleAdsClient. It will automatically load the configuration
    # from 'google-ads.yaml' in the current working directory.
    try:
        googleads_client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        print("Please ensure 'google-ads.yaml' exists and is correctly configured.")
        sys.exit(1)
        
    # Read client customer ID from configuration to query
    customer_id = googleads_client.login_customer_id
    if not customer_id or customer_id == "INSERT_LOGIN_CUSTOMER_ID_HERE":
        print("Error: login_customer_id is not configured in 'google-ads.yaml'.")
        sys.exit(1)
        
    main(googleads_client, str(customer_id).replace("-", ""))
