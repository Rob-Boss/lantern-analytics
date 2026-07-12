# 📊 Combined Advertising & Revenue Performance Report
**Date Range:** July 5, 2026 – July 11, 2026 (This Week) vs. June 28, 2026 – July 4, 2026 (Previous Week)  
**Report Generated:** July 11, 2026 (Saturday afternoon)

---

## 📈 Executive Summary: Performance & Channel Shift

On July 5, 2026, we adjusted campaign settings by capping Performance Max (PMax) display spend, increasing Search campaign daily budgets, and adding competitor negative keywords to filter out lower-intent traffic.

> [!NOTE]
> **Automated Hourly Sync Active:** Booking reservation data, GA4 traffic analytics, and ad campaign performance (Google & Meta Ads) are now configured to sync automatically every hour. The dashboard will continuously update in the background (with a maximum data lag of one hour), no longer requiring manual updates from Ben.

**Key Metrics & Outcomes:**
*   **Direct Booking Growth:** Direct bookings via the Mews Booking Engine increased by 150.9%, driving **$3,908.86** in net revenue, compared to $1,558.15 the previous week.
*   **Checkout Initiations:** Recorded 803 initiated checkouts. This is our first full week of tracking checkout events, which will serve as a baseline for future comparisons (the prior week's data was only partially collected).
*   **Channel Shift:** Total net revenue grew by 57.7% (from $3,583.75 to $5,652.28). The increase in Mews direct bookings offset a 13.9% decrease in Airbnb net revenue.

---

## 📊 7-Day Performance Snapshot

| Metric | This Week (July 5 - 11) | Previous Week (Jun 28 - Jul 4) | % Change | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Total Bookings** | 9 | 7 | **+28.6%** | |
| **Total Gross Revenue** | $5,959.94 | $3,941.21 | **+51.2%** | |
| **Total Net Revenue** | **$5,652.28** | **$3,583.75** | **+57.7%** | Growth driven by Mews direct bookings. |
| **Mews Net Revenue** | $3,908.86 | $1,558.15 | **+150.9%** | |
| **Airbnb Net Revenue** | $1,743.42 | $2,025.60 | **-13.9%** | One booking cancelled and rebooked directly on Mews.<br>Includes manually applied discounts: a couple of 10% discounts and 13% last-minute booking discounts (which have since been disabled). |
| **Total Pageviews** | 9,911 | 11,485 | **-13.7%** | Decrease directly associated with restructuring budget away from the Google PMax campaign and into high-intent search campaigns. |
| **Initiated Checkouts** | **803** | **277** | **+189.9%** | Previous week was a partial week of data collection; this week represents our baseline. |


---

## 🔍 Google Ads Campaign Performance

| Campaign Type | Spend (This Week) | Impressions | Clicks | CTR | Avg. CPC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Google Search (BOF + MOF)** | $311.19 | 4,215 | 382 | 9.06% | $0.81 |
| **Performance Max (Visual)** | $32.22 | 6,410 | 200 | 3.12% | $0.16 |
| **Combined Google Ads** | **$343.41** | **10,625** | **582** | **5.48%** | **$0.59** |

### 🛠️ Google Ads Analysis:
*   **Click & CPC Trends:** Google Ads impressions decreased by **-74.5%** and clicks decreased by **-71.2%**, while average CPC rose by **+315.2%** (from $0.14 to $0.59).
*   **Context:** The decrease in click volume is associated with capping the Performance Max budget, which had previously generated a high volume of low-CPC display network clicks. Shifting budget to Search and implementing competitor negative keywords (e.g., `under canvas`, `terramor`) raised the average CPC, but was accompanied by a 150.9% increase in Mews direct booking revenue (from $1,558.15 to $3,908.86), indicating a higher concentration of active buyers among the remaining search traffic.
*   **Attribution & Conversion Tracking:** This week marked the first time booking revenue was successfully attributed directly to a specific Google Search ad (on July 9). Adjustments to the GA4 integration (enabling Google Ads metrics sync) and the addition of `mews.com` and `lanterncamp.com` to the referral exclusion list were implemented on July 11 to resolve previous cross-domain attribution gaps.

---

## 📱 Meta Ads Campaign Performance

*   **Meta Spend:** $331.16 (-5.3% vs. last week)
*   **Impressions:** 66,461 (stable)
*   **Clicks:** 5,304 (-2.8%)
*   **Landing Page Views:** 3,006 (+5.7%)
*   **Cost per View (CPV):** **$0.11** (-10.4% improvement)
*   **Meta Avg. Daily Spend:** $47.31 (pacing close to the $50.00/day target)

### 🛠️ Meta Ads Analysis:
*   Meta Ads continue to serve as the primary source of traffic volume, maintaining stable impressions (-0.1%) and a cost per view of $0.11.
*   The drive-market targeting remains concentrated in three primary states, with Massachusetts (20%), New York (20%), and Maine (17.9%) accounting for approximately 58% of all Meta landing page views.

---

## ⚙️ Changes Implemented for the Week Ahead

The following configurations were applied on July 11, 2026:

### 1. GA4 to Google Ads Conversion Sync
*   **Action:** Enabled "Import App & Web Metrics" in the Google Ads Data Manager.
*   **Objective:** Allow Google Ads to import website purchase and checkout metrics from GA4 to align conversion data.

### 2. GA4 Referral Exclusions
*   **Action:** Added `lanterncamp.com` and `mews.com` to the Unwanted Referrals list in GA4.
*   **Objective:** Prevent booking engine redirects from being misattributed to `lanterncamp.com / referral`.

### 3. Google Ads Budget Adjustments
*   **Action:** Set Search shared budget to **$45.00/day** and Performance Max budget to **$5.00/day**.
*   **Objective:** Reallocate budget from display network placements to Search query coverage.

### 4. Added Competitor Negatives
*   **Action:** Applied phrase-match negative exclusions to both search campaigns for:
    *   `"sandy pines"`, `"huttopia"`, `"fortland"`, `"woods of eden"`, and `"salt cottages"`.
*   **Objective:** Block ads from displaying on search queries for specific competing resorts.

### 5. Meta Audience Targeting Optimization
*   **Action:** Updated the active *Drive Market* saved audience:
    *   Added **Knox County, Maine** to targeted locations.
    *   Added interests in **`Luxury Travel`**, **`Boutique hotel`**, and **`Vacation rental`**.
