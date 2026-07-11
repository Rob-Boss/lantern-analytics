import React, { useState } from "react";

export default function TrafficTab({ trafficData, loading, isMobile }) {
  const [activeMetric, setActiveMetric] = useState("active_users"); // active_users, checkouts
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (loading) {
    return (
      <div style={{ padding: "80px", textAlign: "center", color: "#606862" }}>
        <div className="spinner" style={{ margin: "0 auto 16px auto", width: "40px", height: "40px", border: "4px solid #e2e8e4", borderTopColor: "#8eb29d", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        Loading web traffic metrics...
      </div>
    );
  }

  const formatNumber = (val) => {
    return new Intl.NumberFormat("en-US").format(val || 0);
  };

  const cleanGeoName = (val) => {
    if (!val || val === "(not set)" || val === "not set") {
      return "Unknown";
    }
    return val;
  };

  const summary = trafficData.summary || { sessions: 0, pageviews: 0, checkouts_initiated: 0, new_users: 0, returning_users: 0, active_users: 0 };
  const funnel = trafficData.funnel || { sessions: 0, checkouts: 0, purchases: 0, checkout_conv_rate: 0, booking_conv_rate: 0 };
  
  const dailyTraffic = trafficData.daily_traffic || [];
  const geoRegions = trafficData.geo_regions || [];
  const geoCities = trafficData.geo_cities || [];

  const todayStr = new Date().toLocaleDateString("en-CA");

  // Trim trailing empty days to keep chart aligned with latest data
  const trimTrailingEmptyDays = (arr, checkIsEmpty) => {
    let endIdx = arr.length - 1;
    while (endIdx >= 0 && checkIsEmpty(arr[endIdx])) {
      endIdx--;
    }
    return arr.slice(0, endIdx + 1);
  };

  const dailyTrafficClean = trimTrailingEmptyDays(
    dailyTraffic.filter(d => d.date < todayStr), 
    d => (d.sessions || 0) === 0 && (d.new_users || 0) === 0
  );

  // Map indexes of interest for interactive hover cards
  const idxJune27 = dailyTrafficClean.findIndex(d => d.date === "2026-06-27");
  const idxJune29 = dailyTrafficClean.findIndex(d => d.date === "2026-06-29");
  const idxJuly2 = dailyTrafficClean.findIndex(d => d.date === "2026-07-02");

  const renderTrafficChart = () => {
    const currentTraffic = dailyTrafficClean;

    if (!currentTraffic || currentTraffic.length === 0) {
      return <div style={{ padding: "60px", textAlign: "center", color: "#606862" }}>No traffic metrics cached in this range.</div>;
    }

    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const pointsCount = currentTraffic.length;

    const getX = (index) => {
      return padding.left + (index * (width - padding.left - padding.right)) / (pointsCount - 1 || 1);
    };

    // Extract values based on selected metric
    const activeValues = currentTraffic.map((d) => {
      if (activeMetric === "active_users") {
        return d.active_users || (d.new_users + d.returning_users) || 0;
      } else {
        return d.checkouts || 0;
      }
    });

    const peakVal = Math.max(...activeValues, 10);
    const maxVal = peakVal * 1.15; // 15% safety boundary above peak

    const getY = (val) => {
      const chartHeight = height - padding.top - padding.bottom;
      return height - padding.bottom - (val / maxVal) * chartHeight;
    };

    let points = [];
    currentTraffic.forEach((d, index) => {
      const x = getX(index);
      const val = activeMetric === "active_users"
        ? (d.active_users || d.new_users + d.returning_users || 0)
        : (d.checkouts || 0);
      points.push(`${x},${getY(val)}`);
    });

    const linePath = pointsCount > 0 ? `M ${points.join(" L ")}` : "";
    const areaPath = pointsCount > 0
      ? `${linePath} L ${getX(pointsCount - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`
      : "";

    // Grid lines
    const gridSteps = 4;
    const gridLines = [];
    for (let i = 0; i <= gridSteps; i++) {
      const val = (maxVal / gridSteps) * i;
      const y = getY(val);
      gridLines.push(
        <g key={`grid-${i}`}>
          <line
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            stroke="#e2e8e4"
            strokeDasharray="4 4"
          />
          <text
            x={padding.left - 10}
            y={y + 4}
            textAnchor="end"
            fontSize="10"
            fill="#606862"
          >
            {formatNumber(Math.round(val))}
          </text>
        </g>
      );
    }

    // X-axis date labels
    const labelStep = Math.max(1, Math.floor(pointsCount / 6));
    const xLabels = [];
    currentTraffic.forEach((d, idx) => {
      if (idx % labelStep === 0 || idx === pointsCount - 1) {
        const x = getX(idx);
        const dateObj = new Date(d.date + "T00:00:00");
        const dateLabel = dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC"
        });

        xLabels.push(
          <g key={`x-label-${idx}`}>
            <line
              x1={x}
              y1={height - padding.bottom}
              x2={x}
              y2={height - padding.bottom + 5}
              stroke="#e2e8e4"
            />
            <text
              x={x}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              fontSize="10"
              fill="#606862"
            >
              {dateLabel}
            </text>
          </g>
        );
      }
    });

    // Dynamic Hover elements
    let hoverGuide = null;
    let circle = null;
    
    if (hoveredIdx !== null && hoveredIdx < pointsCount) {
      const hX = getX(hoveredIdx);
      const hVal = activeValues[hoveredIdx];
      const hY = getY(hVal);
      
      hoverGuide = (
        <line
          x1={hX}
          y1={padding.top}
          x2={hX}
          y2={height - padding.bottom}
          stroke="#b2c2b9"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      );
      
      circle = (
        <circle
          cx={hX}
          cy={hY}
          r="5"
          fill={activeMetric === "active_users" ? "#8eb29d" : "#d67a47"}
          stroke="#ffffff"
          strokeWidth="2"
        />
      );
    }

    // Transparent columns for capturing mouse hover events smoothly
    const columnWidth = (width - padding.left - padding.right) / (pointsCount - 1 || 1);
    const hoverColumns = currentTraffic.map((d, idx) => {
      const x = getX(idx);
      return (
        <rect
          key={`hover-col-${idx}`}
          x={idx === 0 ? padding.left : x - columnWidth / 2}
          y={0}
          width={idx === 0 || idx === pointsCount - 1 ? columnWidth / 2 : columnWidth}
          height={height}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHoveredIdx(idx)}
          onMouseMove={() => setHoveredIdx(idx)}
          onMouseLeave={() => setHoveredIdx(null)}
        />
      );
    });

    // Tooltip popup
    let tooltip = null;
    if (hoveredIdx !== null && currentTraffic.length > hoveredIdx) {
      const d = currentTraffic[hoveredIdx];
      const dateObj = new Date(d.date + "T00:00:00");
      const dateLabel = dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      });

      const xPct = (hoveredIdx / (pointsCount - 1 || 1)) * 100;
      const isRightHalf = hoveredIdx > pointsCount / 2;

      const tooltipStyle = {
        position: "absolute",
        top: "16px",
        [isRightHalf ? "right" : "left"]: `${isRightHalf ? (100 - xPct + 2) : (xPct + 2)}%`,
        backgroundColor: "rgba(45, 49, 46, 0.95)",
        color: "#ffffff",
        padding: "10px 14px",
        borderRadius: "8px",
        fontSize: "11px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        pointerEvents: "none",
        zIndex: 10,
        minWidth: "180px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        transition: "left 0.1s ease-out, right 0.1s ease-out"
      };

      if (activeMetric === "active_users") {
        const totalActive = d.active_users || (d.new_users + d.returning_users);
        tooltip = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateLabel}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "600" }}>Active Users:</span>
              <span style={{ fontWeight: "700", color: "#8eb29d" }}>{formatNumber(totalActive)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
              <span>New Users:</span>
              <span>{formatNumber(d.new_users)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
              <span>Returning Users:</span>
              <span>{formatNumber(d.returning_users)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "4px", marginTop: "4px" }}>
              <span>Total Sessions:</span>
              <span>{formatNumber(d.sessions)}</span>
            </div>
          </div>
        );
      } else {
        const totalActive = d.active_users || (d.new_users + d.returning_users) || 1;
        const convRate = ((d.checkouts || 0) / totalActive) * 100;
        tooltip = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateLabel}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "600" }}>Checkouts:</span>
              <span style={{ fontWeight: "700", color: "#d67a47" }}>{formatNumber(d.checkouts)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "4px", marginTop: "4px" }}>
              <span>Checkout Conversion:</span>
              <span style={{ fontWeight: "700", color: "#8eb29d" }}>{convRate.toFixed(2)}%</span>
            </div>
            <div style={{ fontSize: "9px", color: "#a8b2ac", fontStyle: "italic", marginTop: "2px" }}>
              (Clicks ÷ Active Users)
            </div>
          </div>
        );
      }
    }

    const gradId = activeMetric === "active_users" ? "activeUsersGrad" : "checkoutsGrad";
    const strokeColor = activeMetric === "active_users" ? "#2d4a3e" : "#d67a47";

    return (
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: strokeColor }}></span>
            <span style={{ color: "#606862" }}>
              {activeMetric === "active_users" ? "Total Active Users" : "Checkouts Initiated"}
            </span>
          </div>
        </div>

        {tooltip}

        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto">
          <defs>
            <linearGradient id="activeUsersGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8eb29d" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8eb29d" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="checkoutsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d67a47" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#d67a47" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines}

          {/* Area under curve */}
          {areaPath && (
            <path d={areaPath} fill={`url(#${gradId})`} />
          )}

          {/* Plotted line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover indicator dot */}
          {hoverGuide}
          {circle}

          {/* X axis base */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#b2c2b9"
            strokeWidth="1"
          />

          {/* X axis labels */}
          {xLabels}

          {/* Invisible interactive columns for hover */}
          {hoverColumns}
        </svg>
      </div>
    );
  };

  const maxStateUsers = Math.max(...geoRegions.map(r => r.users), 1);
  
  // Filter out '(not set)' from cities list before calculating peak or slicing
  const filteredGeoCities = geoCities.filter(c => c.city && c.city !== "(not set)" && c.city !== "not set");
  const maxCityUsers = Math.max(...filteredGeoCities.map(c => c.users), 1);

  return (
    <div>
      {/* 1. Daily Traffic Trend line chart (Spans full width) */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", marginBottom: "24px" }}>
        <div className="panel-header" style={{ marginBottom: "16px", flexWrap: "wrap", gap: "16px" }}>
          <div className="panel-title">Daily Web Traffic Trend</div>
          
          {/* Streamlined Metric Toggles */}
          <div style={{ 
            display: "flex", 
            border: "1px solid #e2e8e4", 
            borderRadius: "8px", 
            overflow: "hidden"
          }}>
            {[
              { 
                key: "active_users", 
                label: "Total Active Users", 
                value: summary.active_users || (summary.new_users + summary.returning_users) 
              },
              { 
                key: "checkouts", 
                label: "Checkouts", 
                value: summary.checkouts_initiated 
              }
            ].map((item) => {
              const isActive = activeMetric === item.key;

              return (
                <button
                  key={item.key}
                  onClick={() => { setActiveMetric(item.key); setHoveredIdx(null); }}
                  style={{
                    padding: "10px 18px",
                    background: isActive ? (item.key === "active_users" ? "#2d4a3e" : "#d67a47") : "#ffffff",
                    color: isActive ? "#ffffff" : "#606862",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    transition: "all 0.2s ease",
                    outline: "none"
                  }}
                  onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = "#f4f6f5"; }}
                  onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = "#ffffff"; }}
                >
                  {item.label}: <strong style={{ color: isActive ? "#ffffff" : "#2d312e", marginLeft: "4px" }}>{formatNumber(item.value)}</strong>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {renderTrafficChart()}
        </div>

        {/* Dynamic Interactive Insights & Warnings */}
        <div style={{ 
          marginTop: "16px", 
          borderTop: "1px solid #e2e8e4", 
          paddingTop: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          {activeMetric === "active_users" && (
            <>
              {idxJune27 !== -1 && (
                <div 
                  onMouseEnter={() => setHoveredIdx(idxJune27)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ 
                    fontSize: "11px", 
                    color: "#5b7d90", 
                    backgroundColor: hoveredIdx === idxJune27 ? "#ecf3f6" : "#f4f8fa", 
                    border: "1px dashed #d5e6f0", 
                    padding: "8px 12px", 
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    lineHeight: "1.4",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ fontSize: "12px" }}>ℹ️</span>
                  <span><strong>June 27, 2026:</strong> Meta Ads reached its monthly budget cap, causing ads to temporarily pause and site traffic to briefly drop. (Hover to highlight date on chart)</span>
                </div>
              )}
              {idxJune29 !== -1 && (
                <div 
                  onMouseEnter={() => setHoveredIdx(idxJune29)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ 
                    fontSize: "11px", 
                    color: "#c57e5a", 
                    backgroundColor: hoveredIdx === idxJune29 ? "#fdf3ee" : "#fef8f5", 
                    border: "1px dashed #fcdcc9", 
                    padding: "8px 12px", 
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    lineHeight: "1.4",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span style={{ fontSize: "12px" }}>⚠️</span>
                  <span><strong>June 29, 2026:</strong> Google P-Max campaign activation triggered a temporary bot scrape spike of 1,500+ visits from Algeria before targeting filters were adjusted. (Hover to highlight date on chart)</span>
                </div>
              )}
            </>
          )}

          {activeMetric === "checkouts" && idxJuly2 !== -1 && (
            <div 
              onMouseEnter={() => setHoveredIdx(idxJuly2)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ 
                fontSize: "11px", 
                color: "#c57e5a", 
                backgroundColor: hoveredIdx === idxJuly2 ? "#fdf3ee" : "#fef8f5", 
                border: "1px dashed #fcdcc9", 
                padding: "8px 12px", 
                borderRadius: "6px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                lineHeight: "1.4",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <span style={{ fontSize: "12px" }}>ℹ️</span>
              <span><strong>July 2, 2026:</strong> Checkout tracking went live. Dates before this show 0 checkouts as tracking was not yet active. (Hover to highlight launch date on chart)</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Funnel & Checkout Performance summary totals (Full width) */}
      <div className="panel" style={{ marginBottom: "24px" }}>
        <div className="panel-header" style={{ marginBottom: "12px" }}>
          <div className="panel-title">Funnel & Checkout Performance</div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px", marginBottom: 0 }}>
          <div style={{ border: "1px solid #e2e8e4", padding: "12px", borderRadius: "8px", backgroundColor: "#fcfdfe" }}>
            <div style={{ fontSize: "10.5px", color: "#606862", fontWeight: 600, letterSpacing: "0.02em" }}>TOTAL SESSIONS</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#2d312e", marginTop: "2px" }}>{formatNumber(summary.sessions)}</div>
          </div>
          <div style={{ border: "1px solid #e2e8e4", padding: "12px", borderRadius: "8px", backgroundColor: "#fcfdfe" }}>
            <div style={{ fontSize: "10.5px", color: "#606862", fontWeight: 600, letterSpacing: "0.02em" }}>TOTAL PAGEVIEWS</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#2d312e", marginTop: "2px" }}>{formatNumber(summary.pageviews)}</div>
          </div>
          <div style={{ border: "1px solid #e2e8e4", padding: "12px", borderRadius: "8px", backgroundColor: "#fcfdfe" }}>
            <div style={{ fontSize: "10.5px", color: "#606862", fontWeight: 600, letterSpacing: "0.02em" }}>CHECKOUTS INITIATED</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#d67a47", marginTop: "2px" }}>{formatNumber(summary.checkouts_initiated)}</div>
          </div>
          <div style={{ border: "1px solid #e2e8e4", padding: "12px", borderRadius: "8px", backgroundColor: "#fcfdfe" }}>
            <div style={{ fontSize: "10.5px", color: "#606862", fontWeight: 600, letterSpacing: "0.02em" }}>SESSION TO CHECKOUT CONVERSION</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#2d4a3e", marginTop: "2px" }}>{(funnel.checkout_conv_rate || 0).toFixed(2)}%</div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Panel Grid: Side-by-side Top States & Top Cities lists */}
      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
        
        {/* Top States List */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: "280px" }}>
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div className="panel-title">{isMobile ? "Top 5 States & Regions" : "Top 10 States & Regions"}</div>
          </div>

          {geoRegions.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", color: "#8a928c", fontSize: "13px" }}>
              <span>No cached state metrics found.</span>
              <span style={{ fontSize: "11px", marginTop: "4px", color: "#a2a8a4" }}>Run the data sync in settings to sync geographic data from GA4!</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {geoRegions.slice(0, isMobile ? 5 : 10).map((row, idx) => {
                const pct = maxStateUsers > 0 ? (row.users / maxStateUsers) * 100 : 0;
                return (
                  <div key={`region-${idx}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "600", color: "#2d312e" }}>
                      <span>{cleanGeoName(row.region)}</span>
                      <span style={{ color: "#606862" }}>{formatNumber(row.users)}</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#f0f2f1", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#8eb29d", borderRadius: "3px" }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Cities List */}
        <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: "280px" }}>
          <div className="panel-header" style={{ marginBottom: "14px" }}>
            <div className="panel-title">{isMobile ? "Top 5 Cities" : "Top 10 Cities"}</div>
          </div>

          {filteredGeoCities.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", color: "#8a928c", fontSize: "13px" }}>
              <span>No cached city metrics found.</span>
              <span style={{ fontSize: "11px", marginTop: "4px", color: "#a2a8a4" }}>Run the data sync in settings to sync geographic data from GA4!</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredGeoCities.slice(0, isMobile ? 5 : 10).map((row, idx) => {
                const pct = maxCityUsers > 0 ? (row.users / maxCityUsers) * 100 : 0;
                return (
                  <div key={`city-${idx}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "600", color: "#2d312e" }}>
                      <span>{cleanGeoName(row.city)}</span>
                      <span style={{ color: "#606862" }}>{formatNumber(row.users)}</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#f0f2f1", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#d67a47", borderRadius: "3px" }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
