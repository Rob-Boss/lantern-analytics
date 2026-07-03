import React, { useState } from "react";

export default function TrafficTab({ trafficData, loading }) {
  const [activeMetric, setActiveMetric] = useState("new_users");
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

  const summary = trafficData.summary || { sessions: 0, pageviews: 0, checkouts_initiated: 0, new_users: 0, returning_users: 0 };
  const previousSummary = trafficData.previous_summary || { sessions: 0, pageviews: 0, checkouts_initiated: 0, new_users: 0, returning_users: 0 };
  const funnel = trafficData.funnel || { sessions: 0, checkouts: 0, purchases: 0, checkout_conv_rate: 0, booking_conv_rate: 0 };
  
  const dailyTraffic = trafficData.daily_traffic || [];
  const previousDailyTraffic = trafficData.previous_daily_traffic || [];
  const checkoutToPurchase = funnel.checkout_to_booking_rate || 0;

  // Helper to trim trailing empty days where there is no traffic activity
  const trimTrailingEmptyDays = (arr, checkIsEmpty) => {
    let endIdx = arr.length - 1;
    while (endIdx >= 0 && checkIsEmpty(arr[endIdx])) {
      endIdx--;
    }
    return arr.slice(0, endIdx + 1);
  };

  // Get local today's date in YYYY-MM-DD format
  const todayStr = new Date().toLocaleDateString("en-CA");

  const dailyTrafficClean = trimTrailingEmptyDays(
    dailyTraffic.filter(d => d.date < todayStr), 
    d => (d.sessions || 0) === 0 && (d.new_users || 0) === 0
  );
  const previousDailyTrafficClean = previousDailyTraffic.slice(0, dailyTrafficClean.length);

  // Insight visibility flags based on date range contents
  const dailyTrafficDates = dailyTrafficClean.map(d => d.date);
  const showMetaCapInsight = dailyTrafficDates.includes("2026-06-27");
  const showAlgeriaSpikeInsight = dailyTrafficDates.includes("2026-06-29");

  // Percentage change helper
  const getChange = (current, previous) => {
    if (!previous || previous === 0) {
      return current > 0 ? { text: "↑ 100.0%", isPositive: true } : { text: "-", isNeutral: true };
    }
    const diff = ((current - previous) / previous) * 100;
    const formatted = Math.abs(diff).toFixed(1);
    if (diff > 0) return { text: `↑ ${formatted}%`, isPositive: true };
    if (diff < 0) return { text: `↓ ${formatted}%`, isNegative: true };
    return { text: "-", isNeutral: true };
  };

  const renderGrowthPercent = (current, previous) => {
    const change = getChange(current, previous);
    if (change.isNeutral) {
      return <span style={{ color: "#8a928c", fontSize: "11px", fontWeight: "600" }}>-</span>;
    }
    return (
      <span style={{ 
        color: change.isPositive ? "#137333" : "#c5221f", 
        fontSize: "12px", 
        fontWeight: "600",
        display: "inline-flex",
        alignItems: "center",
        gap: "2px"
      }}>
        {change.text}
      </span>
    );
  };

  const renderTrafficChart = () => {
    const currentTraffic = dailyTrafficClean;
    const previousTraffic = previousDailyTrafficClean;

    if (!currentTraffic || currentTraffic.length === 0) {
      return <div style={{ padding: "60px", textAlign: "center", color: "#606862" }}>No traffic metrics cached in this range.</div>;
    }

    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };

    const currentValues = currentTraffic.map((d) => d[activeMetric] || 0);
    const previousValues = previousTraffic.map((d) => d[activeMetric] || 0);
    const maxVal = Math.max(...currentValues, ...previousValues, 10);
    const pointsCount = currentTraffic.length;

    const getX = (index) => {
      return padding.left + (index * (width - padding.left - padding.right)) / (pointsCount - 1 || 1);
    };

    const getY = (val) => {
      const chartHeight = height - padding.top - padding.bottom;
      return height - padding.bottom - (val / maxVal) * chartHeight;
    };

    let currentPoints = [];
    let previousPoints = [];

    currentTraffic.forEach((d, index) => {
      const x = getX(index);
      const yCurr = getY(d[activeMetric] || 0);
      currentPoints.push(`${x},${yCurr}`);

      if (previousTraffic && previousTraffic.length > index) {
        const yPrev = getY(previousTraffic[index][activeMetric] || 0);
        previousPoints.push(`${x},${yPrev}`);
      }
    });

    const currentPath = pointsCount > 0 ? `M ${currentPoints.join(" L ")}` : "";
    const previousPath = previousPoints.length > 0 ? `M ${previousPoints.join(" L ")}` : "";

    const currentAreaPath = pointsCount > 0
      ? `${currentPath} L ${getX(pointsCount - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`
      : "";

    // Grid lines
    const gridSteps = 4;
    const gridLines = [];
    for (let i = 0; i <= gridSteps; i++) {
      const val = Math.round((maxVal / gridSteps) * i);
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
            {formatNumber(val)}
          </text>
        </g>
      );
    }

    // X-axis date labels
    const labelStep = Math.max(1, Math.floor(pointsCount / 6));
    const xLabels = [];
    dailyTraffic.forEach((d, idx) => {
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
    let currentCircle = null;
    let previousCircle = null;
    
    if (hoveredIdx !== null && hoveredIdx < pointsCount) {
      const hX = getX(hoveredIdx);
      const hVal = currentTraffic[hoveredIdx][activeMetric] || 0;
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
      
      currentCircle = (
        <circle
          cx={hX}
          cy={hY}
          r="5"
          fill="#8eb29d"
          stroke="#ffffff"
          strokeWidth="2"
        />
      );
      
      if (previousTraffic && previousTraffic.length > hoveredIdx) {
        const hPrevVal = previousTraffic[hoveredIdx][activeMetric] || 0;
        const hPrevY = getY(hPrevVal);
        previousCircle = (
          <circle
            cx={hX}
            cy={hPrevY}
            r="5"
            fill="#b2c2b9"
            stroke="#ffffff"
            strokeWidth="2"
          />
        );
      }
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

    // Tooltip elements
    let tooltipElement = null;
    if (hoveredIdx !== null && currentTraffic.length > hoveredIdx) {
      const d = currentTraffic[hoveredIdx];
      const prevD = previousTraffic.length > hoveredIdx ? previousTraffic[hoveredIdx] : null;
      
      const currVal = d[activeMetric] || 0;
      const prevVal = prevD ? (prevD[activeMetric] || 0) : 0;
      const change = getChange(currVal, prevVal);
      const sessionChange = getChange(d.sessions, prevD ? prevD.sessions : 0);
      
      const dateObj = new Date(d.date + "T00:00:00");
      const dateStr = dateObj.toLocaleDateString("en-US", {
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
        minWidth: "185px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        transition: "left 0.1s ease-out, right 0.1s ease-out"
      };
      
      tooltipElement = (
        <div style={tooltipStyle}>
          <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
            {dateStr}
          </div>
          
          {/* Daily Visits (Primary Highlighted) */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ fontWeight: "700", color: "#ffffff" }}>Daily Visits:</span>
            <span style={{ fontWeight: "800", color: "#8eb29d" }}>{formatNumber(d.sessions)}</span>
          </div>
          
          {/* Sub-Metrics Section */}
          <div style={{ borderTop: "1px dashed rgba(255,255,255,0.15)", marginTop: "4px", paddingTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", color: "#a8b2ac" }}>
              <span>New Users:</span>
              <span style={{ fontWeight: "600" }}>{formatNumber(d.new_users)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", color: "#a8b2ac" }}>
              <span>Returning Users:</span>
              <span style={{ fontWeight: "600" }}>{formatNumber(d.active_users - d.new_users)}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: "relative" }}>
        <div className="chart-legend" style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#8eb29d" }}></span>
            <span style={{ color: "#606862" }}>Selected Period</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "0px", borderTop: "2px dashed #b2c2b9" }}></span>
            <span style={{ color: "#8a928c" }}>Previous Period</span>
          </div>
        </div>

        {/* Floating Tooltip Box */}
        {tooltipElement}
        
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto">
          <defs>
            <linearGradient id="sessionsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8eb29d" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8eb29d" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {gridLines}
          
          {/* Area fill under selected period */}
          {currentAreaPath && (
            <path d={currentAreaPath} fill="url(#sessionsGrad)" />
          )}

          {/* Dotted Previous Period line */}
          {previousPath && (
            <path
              d={previousPath}
              fill="none"
              stroke="#b2c2b9"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.75"
            />
          )}
          
          {/* Solid Selected Period line */}
          {currentPath && (
            <path
              d={currentPath}
              fill="none"
              stroke="#8eb29d"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Guide guide line and points */}
          {hoverGuide}
          {previousCircle}
          {currentCircle}

          {/* X Axis base line */}
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

  const getMetricLabel = (key) => {
    switch (key) {
      case "new_users": return "New Users";
      case "returning_users": return "Returning Users";
      case "sessions": return "Web Sessions";
      default: return "";
    }
  };

  return (
    <div>
      {/* Upper Panel Layout */}
      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1.5fr", gap: "24px", marginBottom: "24px" }}>
        
        {/* KPI Summaries & Funnel Statistics */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div className="panel-title">Conversion Ratios</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ backgroundColor: "#fcfdfe", border: "1px solid #e2e8e4", padding: "16px", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "#606862", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "4px" }}>SESSIONS TO CHECKOUT</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#2d312e" }}>{(funnel.checkout_conv_rate || 0).toFixed(2)}%</div>
              </div>
              <div style={{ backgroundColor: "#fcfdfe", border: "1px solid #e2e8e4", padding: "16px", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "#606862", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "4px" }}>CHECKOUT TO BOOKING</div>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#2d4a3e" }}>{(checkoutToPurchase || 0).toFixed(1)}%</div>
              </div>
            </div>
            {dailyTrafficClean.some(d => d.date < "2026-07-02") && (
              <div style={{ 
                marginTop: "16px", 
                fontSize: "11px", 
                color: "#c57e5a", 
                backgroundColor: "#fef8f5", 
                border: "1px dashed #fcdcc9", 
                padding: "10px 12px", 
                borderRadius: "6px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                lineHeight: "1.4"
              }}>
                <span style={{ fontSize: "14px" }}>⚠️</span>
                <span>Checkout tracking was initiated on July 2, 2026. Your range contains dates before this; historical conversion ratios are incomplete.</span>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header" style={{ marginBottom: "12px" }}>
              <div className="panel-title">Traffic & Checkout Totals</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0f3f1", paddingBottom: "10px" }}>
                <span style={{ fontSize: "12px", color: "#606862", fontWeight: 500 }}>Total Pageviews</span>
                <span style={{ fontSize: "16px", fontWeight: "700", color: "#2d312e" }}>{formatNumber(summary.pageviews)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0f3f1", paddingBottom: "10px" }}>
                <span style={{ fontSize: "12px", color: "#606862", fontWeight: 500 }}>Checkouts Initiated</span>
                <span style={{ fontSize: "16px", fontWeight: "700", color: "#d67a47" }}>{formatNumber(summary.checkouts_initiated)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#606862", fontWeight: 500 }}>Total Sessions</span>
                <span style={{ fontSize: "16px", fontWeight: "700", color: "#8eb29d" }}>{formatNumber(summary.sessions)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Dynamic GA4 Chart Panel */}
        <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
          
          <div className="panel-header" style={{ marginBottom: "16px" }}>
            <div className="panel-title">Daily Web Traffic</div>
          </div>

          {/* Interactive GA4 Tab Cards */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr 1fr", 
            border: "1px solid #e2e8e4", 
            borderRadius: "10px", 
            overflow: "hidden", 
            marginBottom: "20px" 
          }}>
            {[
              { key: "new_users", label: "New Users" },
              { key: "returning_users", label: "Returning Users" },
              { key: "sessions", label: "Sessions" }
            ].map((item) => {
              const isActive = activeMetric === item.key;
              const currentVal = summary[item.key] || 0;
              const prevVal = previousSummary[item.key] || 0;

              return (
                <button
                  key={item.key}
                  onClick={() => setActiveMetric(item.key)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "4px",
                    padding: "16px",
                    background: isActive ? "#f4f8f6" : "#ffffff",
                    border: "none",
                    borderBottom: isActive ? "3px solid #8eb29d" : "3px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease-in-out",
                    outline: "none"
                  }}
                  onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = "#fafdff"; }}
                  onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = "#ffffff"; }}
                >
                  <span style={{ 
                    fontSize: "11px", 
                    fontWeight: "600", 
                    color: isActive ? "#2d4a3e" : "#8a928c",
                    letterSpacing: "0.02em"
                  }}>
                    {item.label}
                  </span>
                  <span style={{ 
                    fontSize: "26px", 
                    fontWeight: "700", 
                    color: "#2d312e",
                    lineHeight: "1.1"
                  }}>
                    {formatNumber(currentVal)}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    {renderGrowthPercent(currentVal, prevVal)}
                    <span style={{ fontSize: "10px", color: "#8a928c", fontWeight: "500" }}>vs prev period</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Render Multi-Line SVG Chart */}
          <div style={{ flex: 1 }}>
            {renderTrafficChart()}
          </div>

          {/* Chart Insights & Warnings */}
          {(showMetaCapInsight || showAlgeriaSpikeInsight) && (
            <div style={{ 
              marginTop: "20px", 
              borderTop: "1px solid #e2e8e4", 
              paddingTop: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}>
              <div style={{ fontSize: "11px", color: "#606862", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "4px" }}>CHART INSIGHTS & ANOMALIES</div>
              
              {showMetaCapInsight && (
                <div style={{ 
                  fontSize: "11.5px", 
                  color: "#5b7d90", 
                  backgroundColor: "#f4f8fa", 
                  border: "1px dashed #d5e6f0", 
                  padding: "10px 12px", 
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  lineHeight: "1.4"
                }}>
                  <span style={{ fontSize: "14px" }}>ℹ️</span>
                  <span><strong>June 27, 2026:</strong> Meta Ads reached its monthly budget cap, causing ads to temporarily pause and site traffic to briefly drop.</span>
                </div>
              )}
              
              {showAlgeriaSpikeInsight && (
                <div style={{ 
                  fontSize: "11.5px", 
                  color: "#c57e5a", 
                  backgroundColor: "#fef8f5", 
                  border: "1px dashed #fcdcc9", 
                  padding: "10px 12px", 
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  lineHeight: "1.4"
                }}>
                  <span style={{ fontSize: "14px" }}>⚠️</span>
                  <span><strong>June 29, 2026:</strong> Google P-Max campaign activation triggered a temporary scrape anomaly of 1,500+ bot visits from Algeria before targeting filters were adjusted. This is visible as a traffic spike on this date.</span>
                </div>
              )}
            </div>
          )}
          
        </div>

      </div>
    </div>
  );
}
