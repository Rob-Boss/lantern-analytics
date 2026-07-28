import os
import shutil

src_runbook = "/Users/swardy/Documents/Antigravity Projects/lantern-living-documents/docs/analytics-dashboard-runbook.md"
dst_runbook = "/Users/swardy/Documents/Antigravity Projects/task-manager/tasks/analytics-dashboard-runbook.md"

src_airbnb = "/Users/swardy/Documents/Antigravity Projects/lantern-living-documents/docs/airbnb-tracker-and-strategy.md"
dst_airbnb = "/Users/swardy/Documents/Antigravity Projects/task-manager/tasks/airbnb-tracker-and-strategy.md"

shutil.copyfile(src_runbook, dst_runbook)
print(f"Synced {src_runbook} -> {dst_runbook}")

shutil.copyfile(src_airbnb, dst_airbnb)
print(f"Synced {src_airbnb} -> {dst_airbnb}")
