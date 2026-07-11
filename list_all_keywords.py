import sys
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def main(client, customer_id):
    googleads_service = client.get_service("GoogleAdsService")
    
    query = """
        SELECT
          campaign.name,
          ad_group.name,
          ad_group_criterion.criterion_id,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD'
    """
    
    print(f"Querying all keywords in Customer ID: {customer_id}...")
    try:
        search_request = client.get_type("SearchGoogleAdsRequest")
        search_request.customer_id = customer_id
        search_request.query = query
        
        response = googleads_service.search(request=search_request)
        
        keywords = []
        for row in response:
            campaign = row.campaign
            ad_group = row.ad_group
            criterion = row.ad_group_criterion
            
            keywords.append({
                "campaign": campaign.name,
                "ad_group": ad_group.name,
                "text": criterion.keyword.text,
                "match_type": criterion.keyword.match_type.name,
                "status": criterion.status.name
            })
            
        print("\n" + "="*100)
        print(f"{'Campaign':<30} | {'Ad Group':<25} | {'Keyword':<30} | {'Match Type':<12} | {'Status':<10}")
        print("="*100)
        for kw in keywords:
            print(f"{kw['campaign'][:30]:<30} | {kw['ad_group'][:25]:<25} | {kw['text'][:30]:<30} | {kw['match_type']:<12} | {kw['status']:<10}")
        print("="*100)
        print(f"Total keywords found: {len(keywords)}\n")
        
    except GoogleAdsException as ex:
        print(
            f"Request failed with status '{ex.error.code().name}' and includes the following errors:"
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
