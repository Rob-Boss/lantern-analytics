import sys
import uuid
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def create_campaign_budget(client, customer_id):
    """Creates a new campaign budget."""
    campaign_budget_service = client.get_service("CampaignBudgetService")
    campaign_budget_operation = client.get_type("CampaignBudgetOperation")
    
    budget = campaign_budget_operation.create
    # Budget name must be unique
    unique_id = uuid.uuid4().hex[:6]
    budget.name = f"Lantern Camp Mid-Funnel Budget - {unique_id}"
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    # Set budget to $10.00/day (10,000,000 micros)
    budget.amount_micros = 10000000
    
    print(f"Creating campaign budget: {budget.name}...")
    response = campaign_budget_service.mutate_campaign_budgets(
        customer_id=customer_id, operations=[campaign_budget_operation]
    )
    resource_name = response.results[0].resource_name
    print(f"Successfully created budget resource: {resource_name}")
    return resource_name

def create_campaign(client, customer_id, budget_resource_name):
    """Creates a new Search campaign linked to the budget."""
    campaign_service = client.get_service("CampaignService")
    campaign_operation = client.get_type("CampaignOperation")
    
    campaign = campaign_operation.create
    campaign.name = "Lantern Camp - Search - mid_funnel"
    campaign.status = client.enums.CampaignStatusEnum.ENABLED
    campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    campaign.campaign_budget = budget_resource_name
    campaign.contains_eu_political_advertising = client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    
    # Set bidding strategy to Maximize Clicks (TargetSpend)
    # This is a solid starting strategy for a new non-brand/mid-funnel traffic-generating campaign
    campaign.target_spend = client.get_type("TargetSpend")
    
    # Network settings
    campaign.network_settings.target_google_search = True
    campaign.network_settings.target_search_network = True
    campaign.network_settings.target_content_network = False
    campaign.network_settings.target_partner_search_network = False
    
    print(f"Creating Search campaign: {campaign.name}...")
    response = campaign_service.mutate_campaigns(
        customer_id=customer_id, operations=[campaign_operation]
    )
    resource_name = response.results[0].resource_name
    print(f"Successfully created campaign resource: {resource_name}")
    return resource_name

def create_ad_groups(client, customer_id, campaign_resource_name):
    """Creates two ad groups under the campaign."""
    ad_group_service = client.get_service("AdGroupService")
    
    ad_group_names = [
        "Regional Cabins & Boutique Lodging",
        "Regional Glamping & Luxury Camping"
    ]
    
    operations = []
    for name in ad_group_names:
        op = client.get_type("AdGroupOperation")
        ad_group = op.create
        ad_group.name = name
        ad_group.campaign = campaign_resource_name
        ad_group.status = client.enums.AdGroupStatusEnum.ENABLED
        ad_group.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        operations.append(op)
        
    print(f"Creating ad groups: {', '.join(ad_group_names)}...")
    response = ad_group_service.mutate_ad_groups(
        customer_id=customer_id, operations=operations
    )
    
    ad_group_resources = {}
    for result, op in zip(response.results, operations):
        ad_group_resources[op.create.name] = result.resource_name
        print(f"Successfully created ad group '{op.create.name}': {result.resource_name}")
    return ad_group_resources

def add_keywords(client, customer_id, ad_group_resources):
    """Adds phrase-match keywords to the respective ad groups."""
    criterion_service = client.get_service("AdGroupCriterionService")
    
    keywords_config = {
        "Regional Cabins & Boutique Lodging": [
            "cabins near acadia",
            "modern cabins near acadia",
            "boutique cabin lodging maine",
            "premium cabin rental maine",
            "stay in mid-coast maine",
            "orland maine cabin rentals"
        ],
        "Regional Glamping & Luxury Camping": [
            "glamping near acadia",
            "acadia glamping cabins",
            "luxury glamping in maine",
            "glamping near bar harbor",
            "luxury camping near acadia",
            "maine glamping getaway",
            "modern glamping cabins"
        ]
    }
    
    operations = []
    for ag_name, keywords in keywords_config.items():
        ag_resource = ad_group_resources[ag_name]
        for kw_text in keywords:
            op = client.get_type("AdGroupCriterionOperation")
            criterion = op.create
            criterion.ad_group = ag_resource
            criterion.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            criterion.keyword.text = kw_text
            criterion.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
            operations.append(op)
            
    print("Adding keywords to ad groups...")
    response = criterion_service.mutate_ad_group_criteria(
        customer_id=customer_id, operations=operations
    )
    print(f"Successfully added {len(response.results)} keywords.")

def build_rsa_ad_operation(client, ad_group_resource_name, final_url, headlines, descriptions):
    """Constructs an AdGroupAdOperation for a Responsive Search Ad."""
    operation = client.get_type("AdGroupAdOperation")
    ad_group_ad = operation.create
    ad_group_ad.ad_group = ad_group_resource_name
    ad_group_ad.status = client.enums.AdGroupAdStatusEnum.ENABLED
    
    ad = ad_group_ad.ad
    ad.final_urls.append(final_url)
    
    rsa_info = ad.responsive_search_ad
    
    # Add headlines
    for h_text in headlines:
        headline = client.get_type("AdTextAsset")
        headline.text = h_text
        rsa_info.headlines.append(headline)
        
    # Add descriptions
    for d_text in descriptions:
        description = client.get_type("AdTextAsset")
        description.text = d_text
        rsa_info.descriptions.append(description)
        
    return operation

def create_responsive_search_ads(client, customer_id, ad_group_resources):
    """Creates the Responsive Search Ads for each ad group."""
    ad_group_ad_service = client.get_service("AdGroupAdService")
    
    # Ads assets configuration
    # Headlines and descriptions taken directly from google-ads-creative.md
    final_url = "https://www.lanterncamp.com"
    
    # Ad Group 2 Ads assets
    ag2_headlines = [
        "Cabins Near Acadia Nat'l Park",
        "Modern Cabins Near Acadia",
        "Boutique Cabin Lodging Maine",
        "Premium Cabin Rental Maine",
        "Stay in Mid-Coast Maine",
        "This Is Not A Hotel",
        "Grown-Ups Love Camp, Too",
        "Like Vacation, But Peaceful",
        "A Different Kind of Camp",
        "Modern Comfort in Nature",
        "Escape the Acadia Crowds",
        "A Vacation For Your Dog, Too",
        "Book Direct for Best Rates",
        "Orland Maine Cabin Rentals",
        "100-Mile Mountain Views"
    ]
    
    # Reusing descriptions from Ad Group 1 as noted in guide
    ag2_descriptions = [
        "Scandinavian comfort meets serene nature at our private retreat near Acadia National Park.",
        "Modern solar-powered cabins near Bar Harbor & Mid-Coast Maine. Book your getaway today.",
        "Dog-friendly cabins with 100+ acres of trails, fire pits, and easy Acadia access.",
        "The peaceful Maine escape you've been looking for, just outside tourist-packed Acadia."
    ]
    
    # Ad Group 3 Ads assets
    ag3_headlines = [
        "Glamping Near Acadia",
        "Acadia Glamping Cabins",
        "Luxury Glamping in Maine",
        "Glamping Near Bar Harbor",
        "Luxury Camping Near Acadia",
        "Maine Glamping Getaway",
        "Modern Glamping Cabins",
        "This Is Not A Hotel",
        "Grown-Ups Love Camp, Too",
        "Like Vacation, But Peaceful",
        "A Different Kind of Camp",
        "Modern Comfort in Nature",
        "Solar-Powered Forest Cabins",
        "Book Direct & Save Fees",
        "100-Mile Mountain Views"
    ]
    
    ag3_descriptions = [
        "Experience luxury glamping near Acadia National Park. Modern cabins on 100+ private acres.",
        "Solar-powered luxury cabins with cozy fire pits, hiking trails, and easy Acadia access.",
        "Escape the crowds at our dog-friendly glamping cabins near Acadia. Book your stay today.",
        "Modern Scandinavian comfort meets the Maine wilderness. Premium solar-powered cabins."
    ]
    
    # Build RSA operations
    op_ag2 = build_rsa_ad_operation(
        client, 
        ad_group_resources["Regional Cabins & Boutique Lodging"], 
        final_url, 
        ag2_headlines, 
        ag2_descriptions
    )
    
    op_ag3 = build_rsa_ad_operation(
        client, 
        ad_group_resources["Regional Glamping & Luxury Camping"], 
        final_url, 
        ag3_headlines, 
        ag3_descriptions
    )
    
    print("Creating Responsive Search Ads for the ad groups...")
    response = ad_group_ad_service.mutate_ad_group_ads(
        customer_id=customer_id, operations=[op_ag2, op_ag3]
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
        # Step 1: Create budget
        budget_resource = create_campaign_budget(googleads_client, customer_id)
        
        # Step 2: Create Search campaign
        campaign_resource = create_campaign(googleads_client, customer_id, budget_resource)
        
        # Step 3: Create Ad Groups
        ad_group_resources = create_ad_groups(googleads_client, customer_id, campaign_resource)
        
        # Step 4: Add Keywords
        add_keywords(googleads_client, customer_id, ad_group_resources)
        
        # Step 5: Create Responsive Search Ads
        create_responsive_search_ads(googleads_client, customer_id, ad_group_resources)
        
        print("\nCampaign initialization sequence completed successfully!")
        
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
