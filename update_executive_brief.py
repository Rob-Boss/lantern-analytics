import os
import shutil

report_content = """# 📊 Weekly Executive Brief (Marketing & Operations Update)
**Date Range:** July 19, 2026 – July 25, 2026 (This Week) vs. July 12, 2026 – July 18, 2026 (Previous Week)  
**Published:** July 26, 2026

---

## 📈 Revenue & Channel Yield (Key Weekly Insights)

Weekly booking volume increased by **+82.4%** (31 bookings vs. 17), while total net revenue grew by **+14.8%** ($13,256.01 vs. $11,548.59).

### 🔍 Core Revenue Insights:
* **Yield & Booking Value Disconnect:** Average net revenue per booking dropped **-37.1%** (from **$679.33** down to **$427.61** per stay).
* **Stay Duration:** Average length of stay declined **-17.7%** (from **2.24 nights** to **1.84 nights**), driven by 10 single-night stays (vs. 5 prior). Effective net daily rate (ADR) dropped **-23.5%** (from **$303.91** to **$232.56/night**).
* **Channel Mix Shift:** Mews direct revenue fell to $1,508.44 (6 stays, 11.4% of total net), while Airbnb surged to 25 stays ($11,747.57 net, 88.6% of total net) at lower single-night price points ($164–$250 net).
* **Comped Stays:** Three $0.00 Mews stays were logged on July 22 (Segil, Cryan, Pell). Average net payout across the 28 paid stays was **$473.43**.

| Metric | This Week (July 19 - 25) | Previous Week (July 12 - 18) | % Change |
| :--- | :---: | :---: | :---: |
| **Total Bookings** | **31** | 17 | **+82.4%** |
| **Total Net Revenue** | **$13,256.01** | $11,548.59 | **+14.8%** |
| **Avg. Net Revenue / Booking** | **$427.61** | $679.33 | **-37.1%** |
| **Avg. Length of Stay** | **1.84 nights** | 2.24 nights | **-17.7%** |
| **Net Daily Rate (ADR)** | **$232.56/night** | $303.91/night | **-23.5%** |
| **Mews Net Revenue** | **$1,508.44** (6 stays) | $6,697.19 (7 stays) | **-77.5%** |
| **Airbnb Net Revenue** | **$11,747.57** (25 stays) | $4,851.40 (10 stays) | **+142.1%** |

> [!NOTE]
> **Real-Time Data Sync:** Live metrics automatically sync hourly to the cloud database at [lantern-analytics.vercel.app](https://lantern-analytics.vercel.app).

---

## 📣 Advertising Performance Overview

Ad channels delivered consistent traffic volume to support top-of-funnel reach and retargeting.

| Channel | Weekly Spend | Impressions | Clicks / Views | CTR | Avg. CPC / CPV | Status / Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Google Search (BOF)** | $49.10 | 305 | 115 clicks | 37.70% | $0.43 CPC | High-intent brand search protection. |
| **Google Search (MOF)** | $268.19 | 3,146 | 363 clicks | 11.54% | $0.74 CPC | Mid-funnel Acadia regional search. |
| **Google Performance Max** | $38.95 | 6,144 | 181 clicks | 2.95% | $0.22 CPC | Display & visual retargeting. |
| **Meta Ads (Combined)** | $349.48 | 68,139 | 3,022 LP views | 8.64% | $0.12 CPV | Pacing on target at $49.93/day. |

* **Meta Retargeting:** The `Warm Retargeting Stack` campaign generated 418 landing page views ($0.17 CPV) targeting past site visitors.
* **Geographic Focus:** Massachusetts (20.7%), Maine (20.6%), and New York (15.4%) represented 56.7% of social ad spend.

---

## 🛠️ Operations & Guest Experience

Ongoing development work focuses on building digital tools and structured tracking to streamline guest experience and cabin operations.

### 📋 Guest Actionable Feedback Log
Feedback collected from guest stays is logged and tracked to drive immediate property improvements. 
* **Live Living Document:** [Guest Actionable Feedback Log](docs/guest-actionable-feedback.md) (Web link: [lantern-living-documents.vercel.app/#/docs/guest-actionable-feedback](https://lantern-living-documents.vercel.app/#/docs/guest-actionable-feedback))
* **Active Open Items:** Includes entrance wayfinding/reflectors (`FB-001`), cabin signage night visibility (`FB-002`), pre-arrival supply guidance (`FB-004`), and Field Cabin Wi-Fi AP coverage (`FB-006`).

### ⚙️ Beta Operations & Turn Tools
Interactive web tools have been prototyped to streamline cabin turn timelines and daily site operations, intended to replace legacy workflows.
* **Beta Web App:** [Lantern Operations Beta Tools](https://lantern-operations.vercel.app/audition/timeline)
* **Addison Review Needed:** These tools are currently in beta. **Feedback and input from Addison** are required to refine the turn timeline interface and tailor features to exact on-site operational needs.
"""

# 1. Update local file in Lantern Advertising
local_file = "combined_ads_performance_report.md"
with open(local_file, "w", encoding="utf-8") as f:
    f.write(report_content)
print(f"Updated local report file {local_file}")

# 2. Copy to lantern-living-documents
living_docs_target = "/Users/swardy/Documents/Antigravity Projects/lantern-living-documents/docs/marketing-summary-july-2026.md"
shutil.copyfile(local_file, living_docs_target)
print(f"Copied updated report to {living_docs_target}")
