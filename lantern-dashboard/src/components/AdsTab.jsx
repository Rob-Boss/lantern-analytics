import React, { useState } from "react";

export default function AdsTab({ adsData, loading }) {
  const [activeTab, setActiveTab] = useState("cpc"); // cpc, total_spend, total_clicks, channel_spend
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (loading) {
    return <div style={{ padding: "80px", textAlign: "center", color: "#606862" }}>Loading Ads metrics...</div>;
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val || 0);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat("en-US").format(val || 0);
  };

  const channels = adsData.channels || [];
  const dailyBreakdown = adsData.daily_breakdown || [];

  // Helper to trim trailing empty days where there is no spend or click activity
  const trimTrailingEmptyDays = (arr, checkIsEmpty) => {
    let endIdx = arr.length - 1;
    while (endIdx >= 0 && checkIsEmpty(arr[endIdx])) {
      endIdx--;
    }
    return arr.slice(0, endIdx + 1);
  };

  // Get local today's date in YYYY-MM-DD format
  const todayStr = new Date().toLocaleDateString("en-CA");

  // Exclude today and trim any trailing empty days (e.g. if yesterday is also empty)
  const dailyBreakdownClean = trimTrailingEmptyDays(
    dailyBreakdown.filter(d => d.date < todayStr), 
    d => 
      (d.google_spend || 0) === 0 && 
      (d.meta_spend || 0) === 0 && 
      (d.google_clicks || 0) === 0 && 
      (d.meta_clicks || 0) === 0
  );

  const renderAdsChart = () => {
    if (!dailyBreakdownClean || dailyBreakdownClean.length === 0) {
      return <div style={{ padding: "40px", textAlign: "center", color: "#606862" }}>No ad activity cached in this range.</div>;
    }

    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const pointsCount = dailyBreakdownClean.length;

    const getX = (index) => {
      return padding.left + (index * (width - padding.left - padding.right)) / (pointsCount - 1 || 1);
    };

    // Calculate metric lists and limits based on selected tab mode
    let maxVal = 10;

    const dailyMetrics = dailyBreakdownClean.map((d) => {
      const gSpend = d.google_spend || 0;
      const mSpend = d.meta_spend || 0;
      const gClicks = d.google_clicks || 0;
      const mClicks = d.meta_clicks || 0;

      const totalSpend = gSpend + mSpend;
      const totalClicks = gClicks + mClicks;
      const cpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0.0;

      return {
        date: d.date,
        totalSpend,
        totalClicks,
        cpc,
        gSpend,
        mSpend,
        gClicks,
        mClicks
      };
    });

    if (activeTab === "cpc") {
      maxVal = Math.max(...dailyMetrics.map((d) => d.cpc), 1.0);
    } else if (activeTab === "total_spend") {
      maxVal = Math.max(...dailyMetrics.map((d) => d.totalSpend), 10.0);
    } else if (activeTab === "total_clicks") {
      maxVal = Math.max(...dailyMetrics.map((d) => d.totalClicks), 10);
    } else {
      maxVal = Math.max(...dailyMetrics.map((d) => Math.max(d.gSpend, d.mSpend)), 10.0);
    }

    const getY = (val) => {
      const chartHeight = height - padding.top - padding.bottom;
      return height - padding.bottom - (val / maxVal) * chartHeight;
    };

    // Generate path points
    let pathPoints1 = [];
    let pathPoints2 = [];

    dailyMetrics.forEach((d, idx) => {
      const x = getX(idx);
      if (activeTab === "cpc") {
        pathPoints1.push(`${x},${getY(d.cpc)}`);
      } else if (activeTab === "total_spend") {
        pathPoints1.push(`${x},${getY(d.totalSpend)}`);
      } else if (activeTab === "total_clicks") {
        pathPoints1.push(`${x},${getY(d.totalClicks)}`);
      } else {
        pathPoints1.push(`${x},${getY(d.gSpend)}`);
        pathPoints2.push(`${x},${getY(d.mSpend)}`);
      }
    });

    const path1 = pointsCount > 0 ? `M ${pathPoints1.join(" L ")}` : "";
    const path2 = pointsCount > 0 && pathPoints2.length > 0 ? `M ${pathPoints2.join(" L ")}` : "";

    const areaPath1 = pointsCount > 0 && activeTab !== "channel_spend"
      ? `${path1} L ${getX(pointsCount - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`
      : "";

    // Grid lines (y-axis steps)
    const gridSteps = 4;
    const gridLines = [];
    for (let i = 0; i <= gridSteps; i++) {
      const val = (maxVal / gridSteps) * i;
      const y = getY(val);
      
      gridLines.push(
        <g key={`grid-line-${i}`}>
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
            {activeTab === "total_clicks" ? formatNumber(val) : formatCurrency(val)}
          </text>
        </g>
      );
    }

    // X-axis date labels
    const labelStep = Math.max(1, Math.floor(pointsCount / 6));
    const xLabels = [];
    dailyMetrics.forEach((d, idx) => {
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
    let circle1 = null;
    let circle2 = null;

    if (hoveredIdx !== null && hoveredIdx < pointsCount) {
      const hX = getX(hoveredIdx);
      const hData = dailyMetrics[hoveredIdx];

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

      if (activeTab === "cpc") {
        circle1 = <circle cx={hX} cy={getY(hData.cpc)} r="5" fill="#2d4a3e" stroke="#ffffff" strokeWidth="2" />;
      } else if (activeTab === "total_spend") {
        circle1 = <circle cx={hX} cy={getY(hData.totalSpend)} r="5" fill="#8eb29d" stroke="#ffffff" strokeWidth="2" />;
      } else if (activeTab === "total_clicks") {
        circle1 = <circle cx={hX} cy={getY(hData.totalClicks)} r="5" fill="#d67a47" stroke="#ffffff" strokeWidth="2" />;
      } else {
        circle1 = <circle cx={hX} cy={getY(hData.gSpend)} r="5" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />;
        circle2 = <circle cx={hX} cy={getY(hData.mSpend)} r="5" fill="#ea580c" stroke="#ffffff" strokeWidth="2" />;
      }
    }

    // Transparent columns for capturing mouse hover events smoothly
    const columnWidth = (width - padding.left - padding.right) / (pointsCount - 1 || 1);
    const hoverColumns = dailyMetrics.map((d, idx) => {
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
    if (hoveredIdx !== null && dailyMetrics.length > hoveredIdx) {
      const d = dailyMetrics[hoveredIdx];
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
        minWidth: "175px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        transition: "left 0.1s ease-out, right 0.1s ease-out"
      };

      if (activeTab === "cpc") {
        tooltipElement = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateStr}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Cost Per Click:</span>
              <span style={{ fontWeight: "700", color: "#8eb29d" }}>{formatCurrency(d.cpc)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "4px", color: "#a8b2ac", fontSize: "10.5px" }}>
              <span>Spend / Clicks:</span>
              <span>{formatCurrency(d.totalSpend)} / {d.totalClicks}</span>
            </div>
          </div>
        );
      } else if (activeTab === "total_spend") {
        tooltipElement = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateStr}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Total Spend:</span>
              <span style={{ fontWeight: "700", color: "#81c995" }}>{formatCurrency(d.totalSpend)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
              <span>Google Spend:</span>
              <span>{formatCurrency(d.gSpend)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
              <span>Meta Spend:</span>
              <span>{formatCurrency(d.mSpend)}</span>
            </div>
          </div>
        );
      } else if (activeTab === "total_clicks") {
        tooltipElement = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateStr}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Total Clicks:</span>
              <span style={{ fontWeight: "700", color: "#f7b28d" }}>{formatNumber(d.totalClicks)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
              <span>Google Clicks:</span>
              <span>{formatNumber(d.gClicks)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
              <span>Meta Clicks:</span>
              <span>{formatNumber(d.mClicks)}</span>
            </div>
          </div>
        );
      } else {
        tooltipElement = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateStr}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Google Spend:</span>
              <span style={{ fontWeight: "700", color: "#a5b4fc" }}>{formatCurrency(d.gSpend)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Meta Spend:</span>
              <span style={{ fontWeight: "700", color: "#fdba74" }}>{formatCurrency(d.mSpend)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "4px", color: "#a8b2ac" }}>
              <span>Total Spend:</span>
              <span>{formatCurrency(d.totalSpend)}</span>
            </div>
          </div>
        );
      }
    }

    // Legend styles based on activeTab
    let legend = null;
    if (activeTab === "cpc") {
      legend = (
        <div className="chart-legend" style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#2d4a3e" }}></span>
            <span style={{ color: "#2d4a3e" }}>Combined Cost Per Click (CPC)</span>
          </div>
        </div>
      );
    } else if (activeTab === "total_spend") {
      legend = (
        <div className="chart-legend" style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#8eb29d" }}></span>
            <span style={{ color: "#606862" }}>Total Daily Spend ($)</span>
          </div>
        </div>
      );
    } else if (activeTab === "total_clicks") {
      legend = (
        <div className="chart-legend" style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#d67a47" }}></span>
            <span style={{ color: "#d67a47" }}>Total Link Clicks (Results)</span>
          </div>
        </div>
      );
    } else {
      legend = (
        <div className="chart-legend" style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "3px", backgroundColor: "#4f46e5" }}></span>
            <span style={{ color: "#606862" }}>Google Spend</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "3px", backgroundColor: "#ea580c" }}></span>
            <span style={{ color: "#606862" }}>Meta Spend</span>
          </div>
        </div>
      );
    }

    // Determine gradients to load based on activeTab
    let strokeColor = "#2d4a3e";
    let gradId = "cpcGrad";
    if (activeTab === "total_spend") {
      strokeColor = "#8eb29d";
      gradId = "spendGrad";
    } else if (activeTab === "total_clicks") {
      strokeColor = "#d67a47";
      gradId = "clicksGrad";
    }

    return (
      <div style={{ position: "relative" }}>
        {legend}
        {tooltipElement}
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto">
          <defs>
            <linearGradient id="cpcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2d4a3e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2d4a3e" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8eb29d" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8eb29d" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d67a47" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#d67a47" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines}

          {/* Area gradients */}
          {activeTab !== "channel_spend" && areaPath1 && (
            <path d={areaPath1} fill={`url(#${gradId})`} />
          )}

          {/* Line 2 (For Google vs Meta spend in channel_spend mode) */}
          {path2 && (
            <path
              d={path2}
              fill="none"
              stroke="#ea580c"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Line 1 */}
          {path1 && (
            <path
              d={path1}
              fill="none"
              stroke={activeTab === "channel_spend" ? "#4f46e5" : strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hover elements */}
          {hoverGuide}
          {circle2}
          {circle1}

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

          {/* Hover interaction rects */}
          {hoverColumns}
        </svg>
      </div>
    );
  };

  return (
    <div>
      {/* Comparative Cards */}
      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "24px" }}>
        {channels.map((chan, idx) => {
          const isGoogle = chan.name.toLowerCase().includes("google");
          return (
            <div className="panel" key={chan.name}>
              <div className="panel-header">
                <div className="panel-title">{chan.name} Summary</div>
                <span 
                  className="badge" 
                  style={{ 
                    backgroundColor: isGoogle ? "#eef2ff" : "#fdf2ec", 
                    color: isGoogle ? "#4f46e5" : "#ea580c" 
                  }}
                >
                  {chan.name}
                </span>
              </div>
              
              <div className="kpi-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: 0 }}>
                <div style={{ padding: "12px", border: "1px solid #e2e8e4", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>SPEND</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: isGoogle ? "#2d4a3e" : "#d67a47" }}>
                    {formatCurrency(chan.spend)}
                  </div>
                </div>

                <div style={{ padding: "12px", border: "1px solid #e2e8e4", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>CLICKS</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#2d312e" }}>
                    {formatNumber(chan.clicks)}
                  </div>
                </div>

                <div style={{ padding: "12px", border: "1px solid #e2e8e4", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>IMPRESSIONS</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#2d312e" }}>
                    {formatNumber(chan.impressions)}
                  </div>
                </div>

                <div style={{ padding: "12px", border: "1px solid #e2e8e4", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>CTR</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#2d312e" }}>
                    {chan.ctr.toFixed(2)}%
                  </div>
                </div>

                <div style={{ padding: "12px", border: "1px solid #e2e8e4", borderRadius: "8px", gridColumn: "span 2" }}>
                  <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>
                    {chan.cpv_label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#2d4a3e" }}>
                    {formatCurrency(chan.cpv)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily spend & Performance Chart Panel */}
      <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
          <div className="panel-title">Advertising Performance Analysis</div>
          
          {/* Chart Metric Selector Tabs */}
          <div style={{ display: "flex", border: "1px solid #e2e8e4", borderRadius: "8px", overflow: "hidden" }}>
            {[
              { key: "cpc", label: "Cost Per Click (CPC)" },
              { key: "total_spend", label: "Total Ad Spend" },
              { key: "total_clicks", label: "Link Clicks (Results)" },
              { key: "channel_spend", label: "Channel Budgets" }
            ].map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setHoveredIdx(null); }}
                  style={{
                    padding: "8px 14px",
                    border: "none",
                    background: isSelected ? "#2d4a3e" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#606862",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    outline: "none"
                  }}
                  onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = "#f4f6f5"; }}
                  onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = "#ffffff"; }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "8px" }}>
          {renderAdsChart()}
        </div>
      </div>
    </div>
  );
}
