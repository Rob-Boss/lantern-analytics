import os
import shutil
import subprocess

report_content = """# 📊 Combined Advertising & Revenue Performance Report
**Date Range:** July 19, 2026 – July 25, 2026 (This Week) vs. July 12, 2026 – July 18, 2026 (Previous Week)  
**Report Generated:** July 26, 2026

---

## 📈 Executive Summary: Revenue Dynamics & Yield Analysis

This past week (July 19 – July 25) recorded an **+82.4% increase in booking volume** (31 bookings vs. 17 in the preceding week). Total net revenue increased by **+14.8%** (from **$11,548.59** to **$13,256.01**).

### 🔍 Key Revenue & Yield Findings:
While overall booking volume nearly doubled, revenue growth was moderated by a **-37.1% decline in average net revenue per booking** (falling from **$679.33** to **$427.61** per stay).

1. **Decrease in Average Length of Stay:**
   Average length of stay fell from **2.24 nights** down to **1.84 nights** (-17.7%). Single-night bookings doubled from 5 stays to 10 stays, lowering total revenue generated per reservation.
2. **Effective Net Daily Rate (ADR) Reduction:**
   Average net revenue per night booked dropped **-23.5%** (from **$303.91/night** to **$232.56/night**).
3. **Channel Mix Shift (Airbnb vs. Mews Direct):**
   Direct bookings via the Mews Booking Engine decreased from 7 stays ($6,697.19 net) to 6 stays ($1,508.44 net). Concurrently, Airbnb volume grew from 10 stays ($4,851.40 net) to 25 stays ($11,747.57 net), representing **88.6% of total weekly net revenue**. Airbnb single-night bookings entered at lower net price points ($164 – $250 net per night).
4. **Comped & Owner Stays:**
   Three non-revenue ($0.00) stays were logged in Mews on July 22 (Segil, Cryan, and co-founder Anthony Pell). Excluding these 3 comped stays, average net revenue across the 28 paid bookings was **$473.43** (-30.3% vs. $679.33).

> [!NOTE]
> **Automated Hourly Sync Active:** Booking reservation data, GA4 traffic analytics, and ad campaign performance (Google & Meta Ads) are automatically synced every hour. The dashboard at `https://lantern-analytics.vercel.app` is updated in the background.

---

## 📊 7-Day Performance & Yield Snapshot

| Metric | This Week (July 19 - 25) | Previous Week (July 12 - 18) | % Change | Strategic Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Total Bookings** | **31** | 17 | **+82.4%** | Volume increased by 14 bookings. |
| **Total Gross Revenue** | **$15,329.11** | $12,404.72 | **+23.6%** | Total gross booking value. |
| **Total Net Revenue** | **$13,256.01** | $11,548.59 | **+14.8%** | Growth driven by high Airbnb volume. |
| **Avg. Net Revenue / Booking** | **$427.61** | $679.33 | **-37.1%** | Shift toward shorter stays and Airbnb mix. |
| **Avg. Length of Stay** | **1.84 nights** | 2.24 nights | **-17.7%** | 10 single-night stays logged (vs. 5 prior). |
| **Net Daily Rate (ADR)** | **$232.56/night** | $303.91/night | **-23.5%** | Lower average yield per occupied night. |
| **Mews Net Revenue** | $1,508.44 | $6,697.19 | **-77.5%** | 6 direct Mews bookings (11.4% of revenue). |
| **Airbnb Net Revenue** | $11,747.57 | $4,851.40 | **+142.1%** | 25 bookings (88.6% of revenue). |
| **Total Pageviews** | **11,093** | 8,655 | **+28.2%** | Website traffic volume. |
| **Initiated Checkouts** | **1,115** | 756 | **+47.5%** | Increase of 359 checkouts. |

---

## 🔍 Google Ads Campaign Performance

| Campaign Type | Spend (This Week) | Impressions | Clicks | CTR | Avg. CPC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Google Search (BOF)** | $49.10 | 305 | 115 | 37.70% | $0.43 |
| **Google Search (MOF)** | $268.19 | 3,146 | 363 | 11.54% | $0.74 |
| **Performance Max (Visual)** | $38.95 | 6,144 | 181 | 2.95% | $0.22 |
| **Combined Google Ads** | **$356.24** | **9,595** | **659** | **6.87%** | **$0.54** |

### 🛠️ Google Ads Analysis:
*   **Budget Allocation:** Search campaigns represented $317.29 of spend ($49.10 BOF, $268.19 MOF), while Performance Max display/visual spend totaled $38.95.
*   **Cost & CTR:** Overall Google Ads CPC averaged $0.54 with a 6.87% CTR across 9,595 impressions.
*   **Brand Search CTR:** The Bottom of Funnel search campaign recorded a **37.70% CTR** on branded search terms.

---

## 📱 Meta Ads Campaign Performance

*   **Meta Spend:** $349.48 (+31.1% vs. $266.47 last week)
*   **Impressions:** 68,139 (+29.2%)
*   **Clicks:** 5,890 (+27.3%)
*   **Landing Page Views:** 3,022 (+30.3%)
*   **Cost per View (CPV):** **$0.12**
*   **Meta Avg. Daily Spend:** $49.93 (pacing at the $50.00/day target)

### Meta Campaign Summary
| Campaign Name | Status | Spend | Impressions | Clicks | Landing Page Views | Cost per View |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **HOMEPAGE traffic - static single image - [Drive Market]** | `ACTIVE` | $279.85 | 60,488 | 5,204 | 2,604 | $0.11 |
| **Warm Retargeting Stack - Website + Social** | `ACTIVE` | $69.63 | 7,651 | 686 | 418 | $0.17 |
| **Combined Meta Ads** | **ACTIVE** | **$349.48** | **68,139** | **5,890** | **3,022** | **$0.12** |

### 👥 Drive Market Campaign Breakdown

#### Age Demographics
| Age Demographic | Impressions | Landing Page Views | Total Spend | Cost per View |
| :--- | :---: | :---: | :---: | :---: |
| **18-24** | 1,411 | 21 | $2.49 | $0.12 |
| **25-34** | 8,246 | 162 | $18.02 | $0.11 |
| **35-44** | 9,082 | 367 | $38.15 | $0.10 |
| **45-54** | 9,677 | 435 | $46.17 | $0.11 |
| **55-64** | 13,482 | 692 | $69.36 | $0.10 |
| **65+** | 18,589 | 917 | $105.65 | $0.12 |

#### Geographic Distribution
| State / Region | Impressions | Spend | % of Budget |
| :--- | :---: | :---: | :---: |
| **Massachusetts** | 10,526 | $58.06 | 20.7% |
| **Maine** | 10,497 | $57.73 | 20.6% |
| **New York** | 12,504 | $43.17 | 15.4% |
| **Florida** | 8,829 | $29.19 | 10.4% |
| **New Hampshire** | 3,856 | $20.95 | 7.5% |
| **Connecticut** | 3,572 | $18.70 | 6.7% |
| **Pennsylvania** | 4,024 | $17.06 | 6.1% |
| **New Jersey** | 2,020 | $9.57 | 3.4% |
| **Maryland** | 1,660 | $8.81 | 3.1% |
| **Vermont** | 1,543 | $8.75 | 3.1% |
| **Rhode Island** | 1,457 | $7.85 | 2.8% |

### 🛠️ Meta Ads Analysis:
*   **Warm Retargeting Campaign:** The `Warm Retargeting Stack` campaign spent $69.63 and generated 418 landing page views at $0.17 CPV.
*   **Geographic Focus:** Massachusetts (20.7%), Maine (20.6%), and New York (15.4%) combined for 56.7% of total Drive Market spend.
*   **Pacing & Delivery:** Daily spend averaged $49.93, delivering steady volume across drive market segments.
"""

# 1. Save to local file in Lantern Advertising
local_file = "combined_ads_performance_report.md"
with open(local_file, "w", encoding="utf-8") as f:
    f.write(report_content)
print(f"Updated local file {local_file}")

# 2. Copy to lantern-living-documents
living_docs_target = "/Users/swardy/Documents/Antigravity Projects/lantern-living-documents/docs/marketing-summary-july-2026.md"
shutil.copyfile(local_file, living_docs_target)
print(f"Copied updated report to {living_docs_target}")
