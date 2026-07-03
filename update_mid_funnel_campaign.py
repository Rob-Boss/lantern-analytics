import sys
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def get_campaign_resource_name(client, customer_id):
    """Retrieves the campaign resource name by name."""
    googleads_service = client.get_service("GoogleAdsService")
    query = """
        SELECT campaign.resource_name 
        FROM campaign 
        WHERE campaign.name = 'Lantern Camp - Search - mid_funnel'
        LIMIT 1
    """
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    response = googleads_service.search(request=search_request)
    for row in response:
        return row.campaign.resource_name
    return None

def get_ad_groups(client, customer_id, campaign_resource_name):
    """Retrieves all ad groups under the campaign."""
    googleads_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT ad_group.resource_name, ad_group.name 
        FROM ad_group 
        WHERE ad_group.campaign = '{campaign_resource_name}'
    """
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    response = googleads_service.search(request=search_request)
    
    ad_groups = {}
    for row in response:
        ad_groups[row.ad_group.name] = row.ad_group.resource_name
    return ad_groups

def rename_ad_group_if_needed(client, customer_id, ad_groups):
    """Renames 'Regional Glamping & Luxury Camping' to 'Regional Glamping & Nature Lodging'."""
    ad_group_service = client.get_service("AdGroupService")
    old_name = "Regional Glamping & Luxury Camping"
    new_name = "Regional Glamping & Nature Lodging"
    
    if old_name in ad_groups:
        resource_name = ad_groups[old_name]
        print(f"Renaming ad group from '{old_name}' to '{new_name}'...")
        op = client.get_type("AdGroupOperation")
        ad_group = op.update
        ad_group.resource_name = resource_name
        ad_group.name = new_name
        
        # Set update mask
        op.update_mask.paths.append("name")
        
        response = ad_group_service.mutate_ad_groups(
            customer_id=customer_id, operations=[op]
        )
        print(f"Successfully renamed ad group: {response.results[0].resource_name}")
        
        # Update our dictionary
        ad_groups[new_name] = resource_name
        del ad_groups[old_name]
        
    return ad_groups

def clear_existing_keywords(client, customer_id, campaign_resource_name):
    """Deletes all existing keywords in the campaign's ad groups."""
    googleads_service = client.get_service("GoogleAdsService")
    criterion_service = client.get_service("AdGroupCriterionService")
    
    query = f"""
        SELECT ad_group_criterion.resource_name 
        FROM ad_group_criterion 
        WHERE campaign.resource_name = '{campaign_resource_name}' 
          AND ad_group_criterion.type = 'KEYWORD'
    """
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    response = googleads_service.search(request=search_request)
    
    operations = []
    for row in response:
        op = client.get_type("AdGroupCriterionOperation")
        op.remove = row.ad_group_criterion.resource_name
        operations.append(op)
        
    if operations:
        print(f"Removing {len(operations)} existing keywords...")
        criterion_service.mutate_ad_group_criteria(
            customer_id=customer_id, operations=operations
        )
        print("Existing keywords removed successfully.")
    else:
        print("No keywords found to remove.")

def clear_existing_ads(client, customer_id, campaign_resource_name):
    """Deletes all existing ads in the campaign's ad groups."""
    googleads_service = client.get_service("GoogleAdsService")
    ad_group_ad_service = client.get_service("AdGroupAdService")
    
    query = f"""
        SELECT ad_group_ad.resource_name 
        FROM ad_group_ad 
        WHERE campaign.resource_name = '{campaign_resource_name}'
    """
    search_request = client.get_type("SearchGoogleAdsRequest")
    search_request.customer_id = customer_id
    search_request.query = query
    response = googleads_service.search(request=search_request)
    
    operations = []
    for row in response:
        op = client.get_type("AdGroupAdOperation")
        op.remove = row.ad_group_ad.resource_name
        operations.append(op)
        
    if operations:
        print(f"Removing {len(operations)} existing ads...")
        ad_group_ad_service.mutate_ad_group_ads(
            customer_id=customer_id, operations=operations
        )
        print("Existing ads removed successfully.")
    else:
        print("No ads found to remove.")

def add_new_keywords(client, customer_id, ad_groups):
    """Adds the updated keywords list to the ad groups."""
    criterion_service = client.get_service("AdGroupCriterionService")
    
    keywords_config = {
        "Regional Cabins & Boutique Lodging": [
            "cabins near acadia",
            "modern cabins near acadia",
            "boutique cabin lodging maine",
            "premium cabin rental maine",
            "stay in mid-coast maine",
            "eco retreat near acadia",
            "nature cabins bar harbor"
        ],
        "Regional Glamping & Nature Lodging": [
            "glamping near acadia",
            "acadia glamping cabins",
            "boutique glamping maine",
            "glamping near bar harbor",
            "upscale camping near acadia",
            "maine glamping getaway",
            "modern glamping cabins",
            "eco resort bar harbor"
        ]
    }
    
    operations = []
    for ag_name, keywords in keywords_config.items():
        if ag_name in ad_groups:
            ag_resource = ad_groups[ag_name]
            for kw_text in keywords:
                op = client.get_type("AdGroupCriterionOperation")
                criterion = op.create
                criterion.ad_group = ag_resource
                criterion.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
                criterion.keyword.text = kw_text
                criterion.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
                operations.append(op)
                
    if operations:
        print("Adding revised keywords to ad groups...")
        response = criterion_service.mutate_ad_group_criteria(
            customer_id=customer_id, operations=operations
        )
        print(f"Successfully added {len(response.results)} new keywords.")

def build_rsa_ad_operation(client, ad_group_resource_name, final_url, headlines, descriptions):
    """Constructs an AdGroupAdOperation for a Responsive Search Ad."""
    operation = client.get_type("AdGroupAdOperation")
    ad_group_ad = operation.create
    ad_group_ad.ad_group = ad_group_resource_name
    ad_group_ad.status = client.enums.AdGroupAdStatusEnum.ENABLED
    
    ad = ad_group_ad.ad
    ad.final_urls.append(final_url)
    
    rsa_info = ad.responsive_search_ad
    
    # Add headlines (Max 15)
    for h_text in headlines[:15]:
        headline = client.get_type("AdTextAsset")
        headline.text = h_text
        rsa_info.headlines.append(headline)
        
    # Add descriptions (Max 4)
    for d_text in descriptions[:4]:
        description = client.get_type("AdTextAsset")
        description.text = d_text
        rsa_info.descriptions.append(description)
        
    return operation

def create_new_ads(client, customer_id, ad_groups):
    """Creates the revised Responsive Search Ads for the ad groups."""
    ad_group_ad_service = client.get_service("AdGroupAdService")
    final_url = "https://www.lanterncamp.com"
    
    # Ad Group 1 Headlines (max 15)
    ag1_headlines = [
        "Cabins Near Acadia Nat'l Park",
        "Modern Cabins Near Acadia",
        "Boutique Cabin Lodging Maine",
        "Premium Cabin Rental Maine",
        "Stay in Mid-Coast Maine",
        "A Landscape Hotel near Acadia",
        "Framing the Maine Wilderness",
        "Low-Impact Design in Nature",
        "This Is Not A Hotel",
        "Grown-Ups Love Camp, Too",
        "Like Vacation, But Peaceful",
        "Escape the Acadia Crowds",
        "Your Dog Deserves Vacation Too",
        "Book Direct for Best Rates",
        "100-Mile Sunset Views"
    ]
    
    ag1_descriptions = [
        "Scandinavian comfort meets serene nature at our private retreat near Acadia National Park.",
        "Modern solar-powered cabins near Bar Harbor & Mid-Coast Maine. Book your getaway today.",
        "Dog-friendly cabins with forest trails, private fire pits, and easy Acadia access.",
        "The peaceful Maine escape you've been looking for, just outside tourist-packed Acadia."
    ]
    
    # Ad Group 2 Headlines (max 15)
    ag2_headlines = [
        "Glamping Near Acadia",
        "Acadia Glamping Cabins",
        "Boutique Glamping in Maine",
        "Glamping Near Bar Harbor",
        "Upscale Camping Near Acadia",
        "Maine Glamping Getaway",
        "Modern Glamping Cabins",
        "A Landscape Hotel near Acadia",
        "Eco-Friendly Nature Cabins",
        "Windows Framing the Wilderness",
        "This Is Not A Hotel",
        "Grown-Ups Love Camp, Too",
        "Like Vacation, But Peaceful",
        "Book Direct & Save Fees",
        "100-Mile Sunset Views"
    ]
    
    ag2_descriptions = [
        "Experience upscale nature camping near Acadia National Park on our 166 private acres.",
        "Solar-powered boutique cabins with cozy fire pits, hiking trails, and easy Acadia access.",
        "Escape the crowds at our dog-friendly nature cabins near Acadia. Book your stay today.",
        "Modern Scandinavian comfort designed to low-impact frame the beautiful Maine wilderness."
    ]
    
    operations = []
    
    if "Regional Cabins & Boutique Lodging" in ad_groups:
        op = build_rsa_ad_operation(
            client,
            ad_groups["Regional Cabins & Boutique Lodging"],
            final_url,
            ag1_headlines,
            ag1_descriptions
        )
        operations.append(op)
        
    if "Regional Glamping & Nature Lodging" in ad_groups:
        op = build_rsa_ad_operation(
            client,
            ad_groups["Regional Glamping & Nature Lodging"],
            final_url,
            ag2_headlines,
            ag2_descriptions
        )
        operations.append(op)
        
    if operations:
        print("Creating revised Responsive Search Ads...")
        response = ad_group_ad_service.mutate_ad_group_ads(
            customer_id=customer_id, operations=operations
        )
        for result in response.results:
            print(f"Successfully created Responsive Search Ad: {result.resource_name}")

def main():
    try:
        # Load Google Ads client config
        googleads_client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        sys.exit(1)
        
    customer_id = str(googleads_client.login_customer_id).replace("-", "")
    
    try:
        # Step 1: Find campaign resource name
        campaign_resource = get_campaign_resource_name(googleads_client, customer_id)
        if not campaign_resource:
            print("Error: Could not find the campaign 'Lantern Camp - Search - mid_funnel'")
            sys.exit(1)
            
        print(f"Found campaign: {campaign_resource}")
        
        # Step 2: Get active ad groups
        ad_groups = get_ad_groups(googleads_client, customer_id, campaign_resource)
        
        # Step 3: Rename old ad group if it exists
        ad_groups = rename_ad_group_if_needed(googleads_client, customer_id, ad_groups)
        
        # Step 4: Clear existing keywords and ads
        clear_existing_keywords(googleads_client, customer_id, campaign_resource)
        clear_existing_ads(googleads_client, customer_id, campaign_resource)
        
        # Step 5: Add new keywords and ads
        add_new_keywords(googleads_client, customer_id, ad_groups)
        create_new_ads(googleads_client, customer_id, ad_groups)
        
        print("\nCampaign update sequence completed successfully!")
        
    except GoogleAdsException as ex:
        print(f"\nGoogle Ads Exception encountered:")
        print(f"Request ID: {ex.request_id}")
        for error in ex.failure.errors:
            print(f"\tError code: {error.error_code}")
            print(f"\tError message: {error.message}")
            if error.location:
                for element in error.location.field_path_elements:
                    print(f"\t\tOn field: {element.field_name}")
        sys.exit(1)

if __name__ == "__main__":
    main()
