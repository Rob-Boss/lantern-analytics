#!/usr/bin/env python3
"""
Performance Max (Visual) Campaign Creator for Lantern Camp
Creates the campaign budget and the paused PMax campaign shell via the Google Ads API.
"""

import sys
import uuid
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def create_campaign_budget(client, customer_id):
    """Creates a campaign budget for the PMax campaign."""
    campaign_budget_service = client.get_service("CampaignBudgetService")
    campaign_budget_operation = client.get_type("CampaignBudgetOperation")
    
    budget = campaign_budget_operation.create
    unique_id = uuid.uuid4().hex[:6]
    budget.name = f"Lantern Camp PMax Budget - {unique_id}"
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    # Set daily budget to $15.00 (15,000,000 micros)
    budget.amount_micros = 15000000
    budget.explicitly_shared = False
    
    print(f"Creating campaign budget: {budget.name}...")
    response = campaign_budget_service.mutate_campaign_budgets(
        customer_id=customer_id, operations=[campaign_budget_operation]
    )
    resource_name = response.results[0].resource_name
    print(f"Successfully created budget resource: {resource_name}")
    return resource_name

def create_pmax_campaign(client, customer_id, budget_resource_name):
    """Creates a new Performance Max campaign in a PAUSED state."""
    campaign_service = client.get_service("CampaignService")
    campaign_operation = client.get_type("CampaignOperation")
    
    campaign = campaign_operation.create
    campaign.name = "Lantern Camp - Performance Max - Visual"
    # Keep paused initially so the user can upload images and review in the Google Ads UI
    campaign.status = client.enums.CampaignStatusEnum.PAUSED
    campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.PERFORMANCE_MAX
    campaign.campaign_budget = budget_resource_name
    campaign.brand_guidelines_enabled = False
    campaign.contains_eu_political_advertising = (
        client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    )
    
    # Performance Max campaigns must use conversion-based bidding strategies.
    # We will initialize with Maximize Conversions bidding.
    campaign.maximize_conversions = client.get_type("MaximizeConversions")
    
    print(f"Creating Performance Max campaign: {campaign.name}...")
    response = campaign_service.mutate_campaigns(
        customer_id=customer_id, operations=[campaign_operation]
    )
    resource_name = response.results[0].resource_name
    print(f"Successfully created PMax campaign resource: {resource_name}")
    return resource_name

def main():
    try:
        # Load Google Ads client config from local yaml
        googleads_client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        sys.exit(1)
        
    customer_id = str(googleads_client.login_customer_id).replace("-", "")
    
    try:
        # Step 1: Create Budget
        budget_resource = create_campaign_budget(googleads_client, customer_id)
        
        # Step 2: Create Paused PMax Campaign
        campaign_resource = create_pmax_campaign(googleads_client, customer_id, budget_resource)
        
        print("\n" + "="*60)
        print("PERFORMANCE MAX CAMPAIGN SHELL CREATED SUCCESSFULLY!")
        print("="*60)
        print(f"Campaign Resource: {campaign_resource}")
        print("\nNext Steps:")
        print("1. Log in to the Google Ads dashboard.")
        print("2. Navigate to 'Lantern Camp - Performance Max - Visual'.")
        print("3. Create an Asset Group to upload your photography (images, logos) and link your YouTube video.")
        print("4. Paste the headlines and descriptions from 'google-pmax-creative.md'.")
        print("5. Enable the campaign once assets are fully populated.")
        print("="*60 + "\n")
        
    except GoogleAdsException as ex:
        print(f"\nGoogle Ads API Exception encountered:")
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
