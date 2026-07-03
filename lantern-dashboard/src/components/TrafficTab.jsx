import React, { useState } from "react";

// 50 US States coordinates for grid layout (12 columns x 7 rows)
const US_STATE_GRID = [
  { state: "AK", name: "Alaska", r: 0, c: 0 },
  { state: "ME", name: "Maine", r: 0, c: 11 },
  
  { state: "WA", name: "Washington", r: 1, c: 1 },
  { state: "ID", name: "Idaho", r: 1, c: 2 },
  { state: "MT", name: "Montana", r: 1, c: 3 },
  { state: "ND", name: "North Dakota", r: 1, c: 4 },
  { state: "MN", name: "Minnesota", r: 1, c: 5 },
  { state: "IL", name: "Illinois", r: 1, c: 6 },
  { state: "WI", name: "Wisconsin", r: 1, c: 7 },
  { state: "MI", name: "Michigan", r: 1, c: 8 },
  { state: "NY", name: "New York", r: 1, c: 9 },
  { state: "VT", name: "Vermont", r: 1, c: 10 },
  { state: "NH", name: "New Hampshire", r: 1, c: 11 },
  
  { state: "OR", name: "Oregon", r: 2, c: 1 },
  { state: "NV", name: "Nevada", r: 2, c: 2 },
  { state: "WY", name: "Wyoming", r: 2, c: 3 },
  { state: "SD", name: "South Dakota", r: 2, c: 4 },
  { state: "NE", name: "Nebraska", r: 2, c: 5 },
  { state: "IA", name: "Iowa", r: 2, c: 6 },
  { state: "IN", name: "Indiana", r: 2, c: 7 },
  { state: "OH", name: "Ohio", r: 2, c: 8 },
  { state: "PA", name: "Pennsylvania", r: 2, c: 9 },
  { state: "NJ", name: "New Jersey", r: 2, c: 10 },
  { state: "CT", name: "Connecticut", r: 2, c: 11 },
  
  { state: "CA", name: "California", r: 3, c: 1 },
  { state: "UT", name: "Utah", r: 3, c: 2 },
  { state: "CO", name: "Colorado", r: 3, c: 3 },
  { state: "KS", name: "Kansas", r: 3, c: 4 },
  { state: "MO", name: "Missouri", r: 3, c: 5 },
  { state: "KY", name: "Kentucky", r: 3, c: 6 },
  { state: "WV", name: "West Virginia", r: 3, c: 7 },
  { state: "MD", name: "Maryland", r: 3, c: 8 },
  { state: "DE", name: "Delaware", r: 3, c: 9 },
  { state: "RI", name: "Rhode Island", r: 3, c: 10 },
  { state: "MA", name: "Massachusetts", r: 3, c: 11 },
  
  { state: "AZ", name: "Arizona", r: 4, c: 2 },
  { state: "NM", name: "New Mexico", r: 4, c: 3 },
  { state: "OK", name: "Oklahoma", r: 4, c: 4 },
  { state: "AR", name: "Arkansas", r: 4, c: 5 },
  { state: "TN", name: "Tennessee", r: 4, c: 6 },
  { state: "VA", name: "Virginia", r: 4, c: 7 },
  { state: "NC", name: "North Carolina", r: 4, c: 8 },
  { state: "SC", name: "South Carolina", r: 4, c: 9 },
  
  { state: "TX", name: "Texas", r: 5, c: 3 },
  { state: "LA", name: "Louisiana", r: 5, c: 4 },
  { state: "MS", name: "Mississippi", r: 5, c: 5 },
  { state: "AL", name: "Alabama", r: 5, c: 6 },
  { state: "GA", name: "Georgia", r: 5, c: 7 },
  
  { state: "HI", name: "Hawaii", r: 6, c: 0 },
  { state: "FL", name: "Florida", r: 6, c: 9 }
];

export default function TrafficTab({ trafficData, loading }) {
  const [activeMetric, setActiveMetric] = useState("new_users");
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);

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
  const geoRegions = trafficData.geo_regions || [];
  const geoCities = trafficData.geo_cities || [];

  // Helper to trim trailing empty days
  const trimTrailingEmptyDays = (arr, checkIsEmpty) => {
    let endIdx = arr.length - 1;
    while (endIdx >= 0 && checkIsEmpty(arr[endIdx])) {
      endIdx--;
    }
    return arr.slice(0, endIdx + 1);
  };

  const todayStr = new Date().toLocaleDateString("en-CA");

  const dailyTrafficClean = trimTrailingEmptyDays(
    dailyTraffic.filter(d => d.date < todayStr), 
    d => (d.sessions || 0) === 0 && (d.new_users || 0) === 0
  );
  const previousDailyTrafficClean = previousDailyTraffic.slice(0, dailyTrafficClean.length);

  // Insights flags
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

    // Tooltip popup
    let tooltip = null;
    if (hoveredIdx !== null && currentTraffic.length > hoveredIdx) {
      const d = currentTraffic[hoveredIdx];
      const p = previousTraffic && previousTraffic.length > hoveredIdx ? previousTraffic[hoveredIdx] : null;
      
      const dateObj = new Date(d.date + "T00:00:00");
      const dateLabel = dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      });

      const xPct = (hoveredIdx / (pointsCount - 1 || 1)) * 100;
      const isRightHalf = hoveredIdx > pointsCount / 2;

      tooltip = (
        <div style={{
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
        }}>
          <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
            {dateLabel}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: "600" }}>Daily Visits:</span>
            <span style={{ fontWeight: "700", color: "#8eb29d" }}>{formatNumber(d.sessions)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
            <span>New Users:</span>
            <span>{formatNumber(d.new_users)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
            <span>Returning Users:</span>
            <span>{formatNumber(d.returning_users)}</span>
          </div>
          {p && (
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              borderTop: "1px dashed rgba(255,255,255,0.1)", 
              paddingTop: "4px", 
              marginTop: "4px", 
              fontSize: "10.5px", 
              color: "#a8b2ac" 
            }}>
              <span>Prev Period:</span>
              <span>{formatNumber(p[activeMetric])}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#8eb29d" }}></span>
            <span style={{ color: "#606862" }}>Current Period</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "1px", borderTop: "2px dashed #b2c2b9" }}></span>
            <span style={{ color: "#606862" }}>Previous Period</span>
          </div>
        </div>

        {tooltip}

        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8eb29d" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8eb29d" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines}

          {/* Area under curve */}
          {currentAreaPath && (
            <path d={currentAreaPath} fill="url(#areaGrad)" />
          )}

          {/* Previous period line */}
          {previousPath && (
            <path
              d={previousPath}
              fill="none"
              stroke="#b2c2b9"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current period line */}
          {currentPath && (
            <path
              d={currentPath}
              fill="none"
              stroke="#2d4a3e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover effects */}
          {hoverGuide}
          {previousCircle}
          {currentCircle}

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

  // Build mapping of State Full Name -> Traffic count from GA4 geoRegions
  const trafficByStateName = {};
  geoRegions.forEach(row => {
    trafficByStateName[row.region] = row.users;
  });

  const maxStateUsers = Math.max(...geoRegions.map(r => r.users), 1);
  const maxCityUsers = Math.max(...geoCities.map(c => c.users), 1);

  return (
    <div>
      {/* 1. Daily Traffic Trend line chart (Spans full width now!) */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", marginBottom: "24px" }}>
        <div className="panel-header" style={{ marginBottom: "16px", flexWrap: "wrap", gap: "16px" }}>
          <div className="panel-title">Daily Web Traffic Trend</div>
          
          {/* Interactive GA4 Tab Cards */}
          <div style={{ 
            display: "flex", 
            border: "1px solid #e2e8e4", 
            borderRadius: "8px", 
            overflow: "hidden"
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
                    padding: "10px 16px",
                    background: isActive ? "#2d4a3e" : "#ffffff",
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
                  {item.label}: <strong style={{ color: isActive ? "#ffffff" : "#2d312e", marginLeft: "4px" }}>{formatNumber(currentVal)}</strong>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {renderTrafficChart()}
        </div>

        {/* Insights & Warnings */}
        {(showMetaCapInsight || showAlgeriaSpikeInsight) && (
          <div style={{ 
            marginTop: "16px", 
            borderTop: "1px solid #e2e8e4", 
            paddingTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            {showMetaCapInsight && (
              <div style={{ 
                fontSize: "11px", 
                color: "#5b7d90", 
                backgroundColor: "#f4f8fa", 
                border: "1px dashed #d5e6f0", 
                padding: "8px 12px", 
                borderRadius: "6px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                lineHeight: "1.4"
              }}>
                <span style={{ fontSize: "12px" }}>ℹ️</span>
                <span><strong>June 27, 2026:</strong> Meta Ads reached its monthly budget cap, causing ads to temporarily pause and site traffic to briefly drop.</span>
              </div>
            )}
            {showAlgeriaSpikeInsight && (
              <div style={{ 
                fontSize: "11px", 
                color: "#c57e5a", 
                backgroundColor: "#fef8f5", 
                border: "1px dashed #fcdcc9", 
                padding: "8px 12px", 
                borderRadius: "6px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                lineHeight: "1.4"
              }}>
                <span style={{ fontSize: "12px" }}>⚠️</span>
                <span><strong>June 29, 2026:</strong> Google P-Max campaign activation triggered a temporary scrape anomaly of 1,500+ bot visits from Algeria before targeting filters were adjusted. This is visible as a traffic spike on this date.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Lower Panel Grid: Left: Totals & US Cartogram. Right: Top States & Cities tables */}
      <div className="panel-grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
        
        {/* Left Side: Summary & Cartogram Map */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Traffic and Checkout Totals card */}
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: "12px" }}>
              <div className="panel-title">Funnel & Checkout Performance</div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "14px" }}>
              <div style={{ border: "1px solid #e2e8e4", padding: "10px", borderRadius: "6px" }}>
                <div style={{ fontSize: "10px", color: "#606862", fontWeight: 600 }}>SESSIONS</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#2d312e" }}>{formatNumber(summary.sessions)}</div>
              </div>
              <div style={{ border: "1px solid #e2e8e4", padding: "10px", borderRadius: "6px" }}>
                <div style={{ fontSize: "10px", color: "#606862", fontWeight: 600 }}>PAGEVIEWS</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#2d312e" }}>{formatNumber(summary.pageviews)}</div>
              </div>
              <div style={{ border: "1px solid #e2e8e4", padding: "10px", borderRadius: "6px" }}>
                <div style={{ fontSize: "10px", color: "#606862", fontWeight: 600 }}>CHECKOUTS</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#d67a47" }}>{formatNumber(summary.checkouts_initiated)}</div>
              </div>
              <div style={{ border: "1px solid #e2e8e4", padding: "10px", borderRadius: "6px" }}>
                <div style={{ fontSize: "10px", color: "#606862", fontWeight: 600 }}>CONVERSION</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#2d4a3e" }}>{(funnel.checkout_conv_rate || 0).toFixed(1)}%</div>
              </div>
            </div>

            {/* Warn on checkout limits */}
            {dailyTrafficClean.some(d => d.date < "2026-07-02") && (
              <div style={{ 
                fontSize: "10px", 
                color: "#c57e5a", 
                backgroundColor: "#fef8f5", 
                border: "1px dashed #fcdcc9", 
                padding: "8px 10px", 
                borderRadius: "6px",
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                lineHeight: "1.3"
              }}>
                <span>⚠️</span>
                <span>Checkout tracking was initiated on July 2, 2026. Dates before this have incomplete historical conversion ratios.</span>
              </div>
            )}
          </div>

          {/* US Heatmap Cartogram Panel */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
            <div className="panel-header" style={{ marginBottom: "14px" }}>
              <div className="panel-title">US Traffic Density (Choropleth Cartogram)</div>
            </div>
            
            {/* Tooltip for map hover */}
            <div style={{ 
              height: "22px", 
              fontSize: "11.5px", 
              fontWeight: "600", 
              color: hoveredState ? "#2d4a3e" : "#8a928c", 
              marginBottom: "10px",
              textAlign: "center"
            }}>
              {hoveredState ? `${hoveredState.name}: ${formatNumber(hoveredState.users)} Active Users` : "Hover over a state tile to view visitors"}
            </div>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              <svg viewBox="0 0 460 270" width="100%" height="auto" style={{ maxWidth: "440px" }}>
                {US_STATE_GRID.map((item) => {
                  const val = trafficByStateName[item.name] || 0;
                  const pct = maxStateUsers > 0 ? (val / maxStateUsers) : 0;
                  const x = item.c * (34 + 4) + 4;
                  const y = item.r * (34 + 4) + 4;
                  
                  // Color density interpolation (Greens)
                  // Base color is a clean warm light grey. Positive values scale to forest green.
                  const isMaine = item.state === "ME";
                  const tileColor = val === 0 
                    ? "#f0f2f1" 
                    : `rgba(45, 74, 62, ${0.1 + pct * 0.9})`;

                  return (
                    <g 
                      key={item.state}
                      onMouseEnter={() => setHoveredState({ name: item.name, users: val })}
                      onMouseMove={() => setHoveredState({ name: item.name, users: val })}
                      onMouseLeave={() => setHoveredState(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={x}
                        y={y}
                        width="34"
                        height="34"
                        rx="4"
                        fill={tileColor}
                        stroke={hoveredState && hoveredState.name === item.name ? "#2d4a3e" : "#ffffff"}
                        strokeWidth={hoveredState && hoveredState.name === item.name ? 1.5 : 1}
                        style={{ transition: "all 0.15s ease" }}
                      />
                      <text
                        x={x + 17}
                        y={y + 21}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="700"
                        fill={val > (maxStateUsers * 0.45) ? "#ffffff" : "#4a504c"}
                        style={{ pointerEvents: "none" }}
                      >
                        {item.state}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            
            {/* Map Legend */}
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "14px", fontSize: "10px", color: "#606862" }}>
              <span>0 visits</span>
              <div style={{ display: "flex", gap: "2px" }}>
                <span style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: "#f0f2f1" }}></span>
                <span style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: "rgba(45, 74, 62, 0.2)" }}></span>
                <span style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: "rgba(45, 74, 62, 0.5)" }}></span>
                <span style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: "rgba(45, 74, 62, 1.0)" }}></span>
              </div>
              <span>{formatNumber(maxStateUsers)} visits (Peak)</span>
            </div>
          </div>

        </div>

        {/* Right Side: Top States & Top Cities lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Top States List */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div className="panel-header" style={{ marginBottom: "12px" }}>
              <div className="panel-title">Top 10 States & Regions</div>
            </div>

            {geoRegions.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", color: "#606862", fontSize: "12px" }}>
                No regional data synced for this range.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {geoRegions.slice(0, 10).map((row, idx) => {
                  const pct = maxStateUsers > 0 ? (row.users / maxStateUsers) * 100 : 0;
                  return (
                    <div key={`region-${idx}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "600", color: "#2d312e" }}>
                        <span>{row.region || "(not set)"}</span>
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
          <div className="panel" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div className="panel-header" style={{ marginBottom: "12px" }}>
              <div className="panel-title">Top 10 Cities</div>
            </div>

            {geoCities.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", color: "#606862", fontSize: "12px" }}>
                No city data synced for this range.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {geoCities.slice(0, 10).map((row, idx) => {
                  const pct = maxCityUsers > 0 ? (row.users / maxCityUsers) * 100 : 0;
                  return (
                    <div key={`city-${idx}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "600", color: "#2d312e" }}>
                        <span>{row.city || "(not set)"}</span>
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
    </div>
  );
}
