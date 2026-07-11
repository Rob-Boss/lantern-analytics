import sys
from datetime import datetime
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def main(client, customer_id):
    googleads_service = client.get_service("GoogleAdsService")
    
    query = """
        SELECT
          campaign.name,
          ad_group.name,
          search_term_view.search_term,
          search_term_view.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros
        FROM search_term_view
        WHERE segments.date DURING LAST_30_DAYS
        ORDER BY metrics.clicks DESC, metrics.impressions DESC
    """
    
    print(f"Querying search terms for Customer ID: {customer_id} for the last 30 days...")
    try:
        search_request = client.get_type("SearchGoogleAdsRequest")
        search_request.customer_id = customer_id
        search_request.query = query
        
        response = googleads_service.search(request=search_request)
        
        terms = []
        curious_terms = []
        
        for row in response:
            campaign = row.campaign
            ad_group = row.ad_group
            search_term_view = row.search_term_view
            metrics = row.metrics
            cost = metrics.cost_micros / 1000000.0
            
            term_info = {
                "campaign": campaign.name,
                "ad_group": ad_group.name,
                "search_term": search_term_view.search_term,
                "clicks": metrics.clicks,
                "impressions": metrics.impressions,
                "cost": cost,
                "status": search_term_view.status.name
            }
            terms.append(term_info)
            
            if "curious" in search_term_view.search_term.lower() or "curiosity" in search_term_view.search_term.lower():
                curious_terms.append(term_info)
                
        # Write all terms to a markdown file
        with open("google_search_terms_report.md", "w") as f:
            f.write("# 🔍 Google Ads Search Terms Report (Last 30 Days)\n\n")
            f.write(f"**Customer ID:** {customer_id} | **Date:** {datetime.now().strftime('%Y-%m-%d')}\n\n")
            
            f.write("## 🧐 Curiosity Search Terms (Contains 'curious' or 'curiosity')\n")
            if curious_terms:
                f.write("| Campaign | Ad Group | Search Term | Clicks | Impressions | Cost | Status |\n")
                f.write("| :--- | :--- | :--- | :---: | :---: | :---: | :---: |\n")
                for t in curious_terms:
                    f.write(f"| {t['campaign']} | {t['ad_group']} | `{t['search_term']}` | {t['clicks']} | {t['impressions']} | ${t['cost']:.2f} | {t['status']} |\n")
            else:
                f.write("No search terms containing 'curious' or 'curiosity' were found.\n")
            f.write("\n")
            
            f.write("## 📋 All Search Terms (Top Clicks)\n")
            f.write("| Campaign | Ad Group | Search Term | Clicks | Impressions | Cost | Status |\n")
            f.write("| :--- | :--- | :--- | :---: | :---: | :---: | :---: |\n")
            for t in terms:
                f.write(f"| {t['campaign']} | {t['ad_group']} | `{t['search_term']}` | {t['clicks']} | {t['impressions']} | ${t['cost']:.2f} | {t['status']} |\n")
                
        print(f"Total search terms found: {len(terms)}")
        print(f"Curious/Curiosity search terms found: {len(curious_terms)}")
        print("Report written to google_search_terms_report.md")
        
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
