import sys
import re
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

def get_intent_category(term):
    t_low = term.lower()
    
    # Brand
    if "lantern" in t_low:
        return "Brand (Lantern Camp)"
        
    # Competitors
    competitors = ["under canvas", "terramor", "ferncrest", "yurt", "autocamp", "sandy pines", "huttopia", "woods of eden", "fortland"]
    for comp in competitors:
        if comp in t_low:
            return f"Competitor ({comp.title()})"
            
    # Informational / Curiosity (Questions, photos, exploration)
    info_words = ["does", "is there", "are there", "how", "why", "what", "photo", "map", "guide", "explore", "history", "hike", "trail", "sunset", "weather"]
    for word in info_words:
        if word in t_low:
            return "Informational / Curiosity"
            
    # Transactional / Category (High Intent)
    trans_words = ["cabin", "glamping", "rent", "stay", "resort", "lodging", "cottage", "campground", "booking", "price", "rate"]
    for word in trans_words:
        if word in t_low:
            return "Transactional (Category Search)"
            
    return "Other / Unclassified"

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
    """
    
    print(f"Analyzing search terms for Customer ID: {customer_id}...")
    try:
        search_request = client.get_type("SearchGoogleAdsRequest")
        search_request.customer_id = customer_id
        search_request.query = query
        
        response = googleads_service.search(request=search_request)
        
        categories = {}
        for row in response:
            campaign = row.campaign
            ad_group = row.ad_group
            search_term_view = row.search_term_view
            metrics = row.metrics
            cost = metrics.cost_micros / 1000000.0
            
            term = search_term_view.search_term
            cat = get_intent_category(term)
            
            if cat not in categories:
                categories[cat] = []
                
            categories[cat].append({
                "campaign": campaign.name,
                "ad_group": ad_group.name,
                "term": term,
                "clicks": metrics.clicks,
                "impressions": metrics.impressions,
                "cost": cost,
                "status": search_term_view.status.name
            })
            
        # Write analysis to a markdown file
        with open("search_terms_intent_analysis.md", "w") as f:
            f.write("# 📊 Google Ads Search Terms Intent Analysis\n\n")
            f.write("We categorized all search terms from the last 30 days based on searcher intent (Brand, Competitors, Informational/Curiosity, and Transactional).\n\n")
            
            for cat, items in sorted(categories.items()):
                # Sort items by clicks then impressions descending
                items_sorted = sorted(items, key=lambda x: (x['clicks'], x['impressions']), reverse=True)
                total_clicks = sum(i['clicks'] for i in items_sorted)
                total_impr = sum(i['impressions'] for i in items_sorted)
                total_cost = sum(i['cost'] for i in items_sorted)
                
                f.write(f"## {cat} ({len(items)} terms)\n")
                f.write(f"**Total Clicks:** {total_clicks} | **Total Impressions:** {total_impr} | **Total Cost:** ${total_cost:.2f}\n\n")
                f.write("| Search Term | Campaign | Ad Group | Clicks | Impressions | Cost | Status |\n")
                f.write("| :--- | :--- | :--- | :---: | :---: | :---: | :---: |\n")
                
                for i in items_sorted[:20]:  # Show top 20 for readability
                    f.write(f"| `{i['term']}` | {i['campaign'][:25]} | {i['ad_group'][:20]} | {i['clicks']} | {i['impressions']} | ${i['cost']:.2f} | {i['status']} |\n")
                
                if len(items_sorted) > 20:
                    f.write(f"| *... and {len(items_sorted) - 20} more terms* | | | | | | |\n")
                f.write("\n")
                
        print("Analysis completed and written to search_terms_intent_analysis.md")
        
    except GoogleAdsException as ex:
        print(f"Request failed: {ex}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        googleads_client = GoogleAdsClient.load_from_storage(path="google-ads.yaml")
    except Exception as e:
        print(f"Failed to load client config: {e}")
        sys.exit(1)
        
    customer_id = googleads_client.login_customer_id
    main(googleads_client, str(customer_id).replace("-", ""))
