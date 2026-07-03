import sys
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

def main(client, customer_id):
    """Finds 'Ad group 1' and renames it to 'Brand Protection'."""
    googleads_service = client.get_service("GoogleAdsService")
    ad_group_service = client.get_service("AdGroupService")
    
    # 1. Query to find the resource name of the ad group named 'Ad group 1'
    query = f"""
        SELECT
          ad_group.resource_name,
          ad_group.name
        FROM ad_group
        WHERE ad_group.name = 'Ad group 1'
        LIMIT 1
    """
    
    print(f"Searching for 'Ad group 1' in Customer ID: {customer_id}...")
    try:
        search_request = client.get_type("SearchGoogleAdsRequest")
        search_request.customer_id = customer_id
        search_request.query = query
        
        response = googleads_service.search(request=search_request)
        
        ad_group_resource_name = None
        for row in response:
            ad_group_resource_name = row.ad_group.resource_name
            break
            
        if not ad_group_resource_name:
            print("Error: Could not find an ad group named 'Ad group 1'.")
            sys.exit(1)
            
        print(f"Found ad group resource: {ad_group_resource_name}")
        print("Renaming to 'Brand Protection'...")
        
        # 2. Construct the update operation
        ad_group_operation = client.get_type("AdGroupOperation")
        ad_group = ad_group_operation.update
        ad_group.resource_name = ad_group_resource_name
        ad_group.name = "Brand Protection"
        
        # Set the update mask
        ad_group_operation.update_mask.paths.append("name")
        
        # 3. Mutate the ad group
        mutate_response = ad_group_service.mutate_ad_groups(
            customer_id=customer_id, operations=[ad_group_operation]
        )
        
        updated_resource = mutate_response.results[0].resource_name
        print(f"Successfully updated ad group. New resource name: {updated_resource}")
        
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
