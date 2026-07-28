import os
import shutil

report_content = """# 📊 Weekly Executive Brief (Marketing, PR & Operations Update)
**Date Range:** July 19, 2026 – July 25, 2026 (This Week) vs. July 12, 2026 – July 18, 2026 (Previous Week)  
**Published:** July 26, 2026

---

## 📈 Revenue & Channel Yield (Key Weekly Insights)

Weekly booking volume increased by **+82.4%** (31 bookings vs. 17). **Total Gross Guest Revenue grew by +32.8%** ($17,864.26 vs. $13,451.66), and **Net Host Revenue grew by +23.6%** ($15,329.11 vs. $12,404.72).

> [!NOTE]
> **OTA Fee & Payout Accounting:** Mews receives the Net Host Payout after Airbnb deducts its 15.5% host fee ($2,535.15 total fee deducted last week). The backend accurately reconstructs True Gross Guest Charges ($17,864.26) and records Net Host Revenue ($15,329.11). Subtracting total marketing spend ($705.72) yields **$14,623.39 in Net Revenue After Marketing**.

### 🔍 Core Revenue Insights:
* **Yield & Booking Value Dynamics:** Average gross booking value moved from **$791.27** to **$576.27/stay** (-27.2%). Average net payout per stay moved from **$729.69** to **$494.49/stay** (-32.2%).
* **Stay Duration:** Average length of stay declined from **2.24 nights** to **1.84 nights** (-17.7%), driven by 10 single-night stays (vs. 5 prior). Effective net daily rate (ADR) moved from **$326.44** to **$268.93/night** (-17.6%).
* **Channel Mix Shift:** Mews direct net revenue was $1,508.44 (6 stays, 9.8% of total net), while Airbnb generated 25 stays ($13,820.67 net, 90.2% of total net) at lower single-night price points.
* **Comped Stays:** Three $0.00 Mews stays were logged on July 22 (Segil, Cryan, Pell). Average net payout across the 28 paid stays was **$547.47**.

| Metric | This Week (July 19 - 25) | Previous Week (July 12 - 18) | % Change |
| :--- | :---: | :---: | :---: |
| **Total Bookings** | **31** | 17 | **+82.4%** |
| **Gross Guest Revenue (Before Fees)** | **$17,864.26** | $13,451.66 | **+32.8%** |
| **Airbnb OTA Host Fees (15.5%)** | **-$2,535.15** | -$1,046.94 | **+142.1%** |
| **Net Host Revenue (Payout Remitted)** | **$15,329.11** | $12,404.72 | **+23.6%** |
| **Total Ad Spend (Google + Meta)** | **-$705.72** | -$629.92 | **+12.0%** |
| **Net Revenue After Marketing** | **$14,623.39** | $11,774.80 | **+24.2%** |
| **Avg. Gross Value / Booking** | **$576.27** | $791.27 | **-27.2%** |
| **Avg. Net Payout / Booking** | **$494.49** | $729.69 | **-32.2%** |
| **Avg. Length of Stay** | **1.84 nights** | 2.24 nights | **-17.7%** |
| **Net Daily Rate (ADR)** | **$268.93/night** | $326.44/night | **-17.6%** |

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

## 📰 Public Relations (PR), Earned Media & Creator Outreach

Recent PR outreach and creator trade stays have generated active responses and upcoming media visits.

### 👥 Recent Hosted Creator & Media Stays
* **Recent Visits Logged:** Hosted stays completed by **Amy** (creator stay), **Jake Cryan** (July 22), and **Melissa Segil** (July 22).
* **Discussion Point & Action:** Review stay outcomes, collect UGC photography/video assets, and coordinate follow-up outreach for tagged social posts and reviews.

### 📅 Upcoming High-Value Writer Visits
* **Anna Fiorentino (AFAR / Nat Geo Travel):** Key Maine-based freelancer (living in Kennebunkport) scheduled for an upcoming hosted stay. High-priority target for national travel feature coverage.
* **Danielle Devine (Maine Home + Design EIC):** Open to a late summer / early fall family stay ahead of the **September 15 text deadline** for the Nov/Dec Architecture issue ("Spaces" or "Design Field Trip" feature).
* **Zoë Sessums (Architectural Digest / Domino):** Active coordination via Carla Tracy to confirm rescheduled hosted stay dates.

### 📩 Founder Outreach Win (Leibal / The Design Release)
Addison received a direct inbound reply from **Leo Lei** (Founder of *Leibal* / *The Design Release*):
> *“Hi Addison, Thank you so much for reaching out! I am interested in featuring this on The Design Release - are you currently hosting media? Best, Leo Lei, Founder”*
* **Next Action:** Follow up with Leo Lei to discuss media hosting availability and provide high-resolution architectural photography selects.

### 🤝 Agency Alignment (Carla Tracy Coordination)
* Pitch warming active across target outlets: *The Boston Globe* (non-luxury price points & dark night sky stargazing angles), *Boston Home* (lodging essentials with Jackie), and *Decor Maine* (in-person agreement with Susan Grisanti).
* Tracker & Sync Links: [PR & Media Outreach Tracker](docs/media-outreach-tracker.md) | [Carla Tracy Meeting Notes](docs/carla-tracy-meeting-notes.md)

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
