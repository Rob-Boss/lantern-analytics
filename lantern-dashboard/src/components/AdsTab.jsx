import React, { useState } from "react";

export default function AdsTab({ adsData, loading, isMobile }) {
  const [activeTab, setActiveTab] = useState("cpc"); // cpc, daily_spend, total_clicks, channel_spend
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

  // Helper to trim trailing empty days
  const trimTrailingEmptyDays = (arr, checkIsEmpty) => {
    let endIdx = arr.length - 1;
    while (endIdx >= 0 && checkIsEmpty(arr[endIdx])) {
      endIdx--;
    }
    return arr.slice(0, endIdx + 1);
  };

  // Get local today's date in YYYY-MM-DD format
  const todayStr = new Date().toLocaleDateString("en-CA");

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

    let runningSpendSum = 0;
    let runningClicksSum = 0;
    let daysElapsedSinceTracking = 0;

    const dailyMetrics = dailyBreakdownClean.map((d) => {
      const gSpend = d.google_spend || 0;
      const mSpend = d.meta_spend || 0;
      const gClicks = d.google_clicks || 0;
      const mClicks = d.meta_clicks || 0;

      const totalSpend = gSpend + mSpend;
      const totalClicks = gClicks + mClicks;
      
      const isTrackingActive = d.date >= "2026-06-18";
      
      if (isTrackingActive) {
        runningSpendSum += totalSpend;
        runningClicksSum += totalClicks;
        daysElapsedSinceTracking += 1;
      }
      
      const dailyCpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0.0;
      const runningCpc = (isTrackingActive && runningClicksSum > 0) 
        ? (runningSpendSum / runningClicksSum) 
        : 0.0;
        
      const runningAvgClicks = (isTrackingActive && daysElapsedSinceTracking > 0)
        ? (runningClicksSum / daysElapsedSinceTracking)
        : 0.0;

      return {
        date: d.date,
        totalSpend,
        totalClicks,
        cpc: runningCpc, // Renders the running average CPC on the chart
        dailyCpc, // Retained for display in tooltips
        runningAvgClicks, // Renders the running average clicks / day on the chart
        gSpend,
        mSpend,
        gClicks,
        mClicks
      };
    });

    // Calculate overall period averages for reference lines and tooltips, excluding days with $0 spend
    const googleSpendDays = dailyMetrics.filter(d => d.gSpend > 0).length;
    const metaSpendDays = dailyMetrics.filter(d => d.mSpend > 0).length;
    const combinedSpendDays = dailyMetrics.filter(d => d.totalSpend > 0).length;

    const totalGoogleSpend = dailyMetrics.reduce((acc, curr) => acc + curr.gSpend, 0);
    const totalMetaSpend = dailyMetrics.reduce((acc, curr) => acc + curr.mSpend, 0);

    const avgGoogleSpend = googleSpendDays > 0 ? (totalGoogleSpend / googleSpendDays) : 0;
    const avgMetaSpend = metaSpendDays > 0 ? (totalMetaSpend / metaSpendDays) : 0;
    const avgTotalSpend = combinedSpendDays > 0 ? ((totalGoogleSpend + totalMetaSpend) / combinedSpendDays) : 0;

    // Calculate 7-day moving average combined spend
    const last7DaysSpend = dailyMetrics.slice(-7);
    const totalSpend7d = last7DaysSpend.reduce((acc, curr) => acc + curr.totalSpend, 0);
    const avgCombinedSpend7d = last7DaysSpend.length > 0 ? (totalSpend7d / last7DaysSpend.length) : 0.0;

    if (activeTab === "cpc") {
      const peakCpc = Math.max(...dailyMetrics.map((d) => d.cpc), 0.05);
      maxVal = peakCpc * 1.15; // 15% safety margin above peak
    } else if (activeTab === "daily_spend") {
      const peakSpend = Math.max(...dailyMetrics.map((d) => d.totalSpend), 10.0);
      maxVal = peakSpend * 1.15;
    } else {
      const peakClicks = Math.max(...dailyMetrics.map((d) => d.runningAvgClicks), 10);
      maxVal = peakClicks * 1.15;
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
      } else if (activeTab === "daily_spend") {
        pathPoints1.push(`${x},${getY(d.totalSpend)}`);
        pathPoints2.push(`${x},${getY(d.gSpend)}`);
      } else if (activeTab === "total_clicks") {
        pathPoints1.push(`${x},${getY(d.runningAvgClicks)}`);
      }
    });

    const path1 = pointsCount > 0 ? `M ${pathPoints1.join(" L ")}` : "";
    const path2 = pointsCount > 0 && pathPoints2.length > 0 ? `M ${pathPoints2.join(" L ")}` : "";

    const areaPath1 = pointsCount > 0
      ? `${path1} L ${getX(pointsCount - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`
      : "";

    const areaPath2 = pointsCount > 0 && activeTab === "daily_spend"
      ? `${path2} L ${getX(pointsCount - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`
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
            {activeTab === "total_clicks" ? formatNumber(Math.round(val)) : formatCurrency(val)}
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
      } else if (activeTab === "daily_spend") {
        circle1 = <circle cx={hX} cy={getY(hData.totalSpend)} r="5" fill="#ea580c" stroke="#ffffff" strokeWidth="2" />;
        circle2 = <circle cx={hX} cy={getY(hData.gSpend)} r="5" fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />;
      } else if (activeTab === "total_clicks") {
        circle1 = <circle cx={hX} cy={getY(hData.runningAvgClicks)} r="5" fill="#d67a47" stroke="#ffffff" strokeWidth="2" />;
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
        const isTrackingActive = d.date >= "2026-06-18";
        tooltipElement = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateStr}
            </div>
            {!isTrackingActive ? (
              <div style={{ color: "#a8b2ac", fontStyle: "italic", fontSize: "11px", textAlign: "center", padding: "4px 0" }}>
                Ad tracking not active
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Running Avg CPC:</span>
                  <span style={{ fontWeight: "700", color: "#8eb29d" }}>{formatCurrency(d.cpc)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
                  <span>Daily CPC:</span>
                  <span>{formatCurrency(d.dailyCpc)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "4px", marginTop: "4px", color: "#a8b2ac", fontSize: "10.5px" }}>
                  <span>Daily Cost / Clicks:</span>
                  <span>{formatCurrency(d.totalSpend)} / {d.totalClicks}</span>
                </div>
              </>
            )}
          </div>
        );
      } else if (activeTab === "daily_spend") {
        tooltipElement = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateStr}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Daily Spend:</span>
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
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "4px", marginTop: "4px", fontWeight: "700", color: "#b2c2b9" }}>
              <span>Average Daily:</span>
              <span>{formatCurrency(avgTotalSpend)}/day</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#a8b2ac", paddingLeft: "8px" }}>
              <span>Google Avg:</span>
              <span>{formatCurrency(avgGoogleSpend)}/day</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#a8b2ac", paddingLeft: "8px" }}>
              <span>Meta Avg:</span>
              <span>{formatCurrency(avgMetaSpend)}/day</span>
            </div>
          </div>
        );
      } else if (activeTab === "total_clicks") {
        const isTrackingActive = d.date >= "2026-06-18";
        tooltipElement = (
          <div style={tooltipStyle}>
            <div style={{ fontWeight: "700", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px", color: "#b2c2b9" }}>
              {dateStr}
            </div>
            {!isTrackingActive ? (
              <div style={{ color: "#a8b2ac", fontStyle: "italic", fontSize: "11px", textAlign: "center", padding: "4px 0" }}>
                Ad tracking not active
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Running Avg Clicks:</span>
                  <span style={{ fontWeight: "700", color: "#f7b28d" }}>{Math.round(d.runningAvgClicks)}/day</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac" }}>
                  <span>Daily Clicks:</span>
                  <span>{formatNumber(d.totalClicks)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac", paddingLeft: "8px" }}>
                  <span>Google Clicks:</span>
                  <span>{formatNumber(d.gClicks)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#a8b2ac", paddingLeft: "8px" }}>
                  <span>Meta Clicks:</span>
                  <span>{formatNumber(d.mClicks)}</span>
                </div>
              </>
            )}
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#a8b2ac" }}>
              <span>Google Avg:</span>
              <span>{formatCurrency(avgGoogleSpend)}/day</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
              <span>Meta Spend:</span>
              <span style={{ fontWeight: "700", color: "#fdba74" }}>{formatCurrency(d.mSpend)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#a8b2ac" }}>
              <span>Meta Avg:</span>
              <span>{formatCurrency(avgMetaSpend)}/day</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "4px", marginTop: "4px" }}>
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
            <span style={{ color: "#2d4a3e" }}>Running Average CPC</span>
          </div>
        </div>
      );
    } else if (activeTab === "daily_spend") {
      legend = (
        <div className="chart-legend" style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#ea580c" }}></span>
            <span style={{ color: "#606862" }}>Meta Spend</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#4f46e5" }}></span>
            <span style={{ color: "#606862" }}>Google Spend</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "1px", borderTop: "2px dashed #ea580c" }}></span>
            <span style={{ color: "#ea580c", opacity: 0.8 }}>7D Avg Combined ({formatCurrency(avgCombinedSpend7d)}/day)</span>
          </div>
        </div>
      );
    } else {
      legend = (
        <div className="chart-legend" style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#d67a47" }}></span>
            <span style={{ color: "#d67a47" }}>Running Average Clicks / Day</span>
          </div>
        </div>
      );
    }

    // Determine gradients to load based on activeTab
    let strokeColor = "#2d4a3e";
    let gradId = "cpcGrad";
    if (activeTab === "daily_spend") {
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
            <linearGradient id="googleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ea580c" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines}

          {/* Area gradients */}
          {activeTab === "daily_spend" ? (
            <>
              {areaPath1 && <path d={areaPath1} fill="url(#metaGrad)" />}
              {areaPath2 && <path d={areaPath2} fill="url(#googleGrad)" />}
            </>
          ) : (
            areaPath1 && <path d={areaPath1} fill={`url(#${gradId})`} />
          )}

          {/* Horizontal Average reference line (Daily spend tab only) */}
          {activeTab === "daily_spend" && (
            <g>
              <line
                x1={padding.left}
                y1={getY(avgCombinedSpend7d)}
                x2={width - padding.right}
                y2={getY(avgCombinedSpend7d)}
                stroke="#ea580c"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.5"
              />
              <text
                x={width - padding.right - 6}
                y={getY(avgCombinedSpend7d) - 6}
                textAnchor="end"
                fontSize="9.5"
                fontWeight="600"
                fill="#ea580c"
                opacity="0.85"
              >
                7D Avg Combined: {formatCurrency(avgCombinedSpend7d)}/day
              </text>
            </g>
          )}

          {/* Line 2 (For Google Spend in daily_spend stacked mode) */}
          {path2 && (
            <path
              d={path2}
              fill="none"
              stroke={activeTab === "daily_spend" ? "#4f46e5" : "#ea580c"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Line 1 (For Total/Meta Spend in daily_spend stacked mode, or CPC/Clicks lines) */}
          {path1 && (
            <path
              d={path1}
              fill="none"
              stroke={activeTab === "daily_spend" ? "#ea580c" : strokeColor}
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

  // Calculate 7-day moving average CPC, CPV and CTR
  const last7Days = dailyBreakdownClean.slice(-7);
  const gSpend7d = last7Days.reduce((acc, curr) => acc + (curr.google_spend || 0), 0);
  const gClicks7d = last7Days.reduce((acc, curr) => acc + (curr.google_clicks || 0), 0);
  const gImpressions7d = last7Days.reduce((acc, curr) => acc + (curr.google_impressions || 0), 0);
  const googleCpc7d = gClicks7d > 0 ? (gSpend7d / gClicks7d) : 0.0;
  const googleCtr7d = gImpressions7d > 0 ? (gClicks7d / gImpressions7d * 100.0) : 0.0;

  const mSpend7d = last7Days.reduce((acc, curr) => acc + (curr.meta_spend || 0), 0);
  const mClicks7d = last7Days.reduce((acc, curr) => acc + (curr.meta_clicks || 0), 0);
  const mImpressions7d = last7Days.reduce((acc, curr) => acc + (curr.meta_impressions || 0), 0);
  const metaCpv7d = mClicks7d > 0 ? (mSpend7d / mClicks7d) : 0.0;
  const metaCtr7d = mImpressions7d > 0 ? (mClicks7d / mImpressions7d * 100.0) : 0.0;

  return (
    <div>
      {/* Comparative Cards */}
      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "24px" }}>
        {channels.map((chan, idx) => {
          const isGoogle = chan.name.toLowerCase().includes("google");
          const cpv7d = isGoogle ? googleCpc7d : metaCpv7d;
          const ctr7d = isGoogle ? googleCtr7d : metaCtr7d;
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
                {!isMobile && (
                  <div style={{ padding: "12px", border: "1px solid #e2e8e4", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>SPEND</div>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: isGoogle ? "#2d4a3e" : "#d67a47" }}>
                      {formatCurrency(chan.spend)}
                    </div>
                  </div>
                )}

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

                {!isMobile && (
                  <div style={{ padding: "12px", border: "1px solid #e2e8e4", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>CTR (7D MOVING AVG)</div>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "#2d312e" }}>
                      {ctr7d.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#a2a8a4", marginTop: "4px" }}>
                      Lifetime CTR: {chan.ctr.toFixed(2)}%
                    </div>
                  </div>
                )}

                <div style={{ padding: "12px", border: "1px solid #e2e8e4", borderRadius: "8px", gridColumn: "span 2" }}>
                  <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>
                    {chan.cpv_label.toUpperCase()} (7D MOVING AVG)
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#2d4a3e" }}>
                    {formatCurrency(cpv7d)}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#a2a8a4", marginTop: "4px" }}>
                    Lifetime average: {formatCurrency(chan.cpv)}
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
              { key: "daily_spend", label: "Daily Ad Spend" },
              { key: "total_clicks", label: "Link Clicks (Results)" }
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
