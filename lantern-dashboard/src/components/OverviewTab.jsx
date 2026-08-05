import React, { useState } from "react";

export default function OverviewTab({ kpis, trendChart, channelSummary = [], revenueByDayOfWeek = [], loading, isMobile }) {
  const [hoveredData, setHoveredData] = useState(null);
  const [hoveredDow, setHoveredDow] = useState(null);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading metrics...</div>;
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat("en-US").format(val || 0);
  };

  const getChannelBadgeClass = (channel) => {
    const ch = channel.toLowerCase();
    if (ch.includes("direct") || ch.includes("mews")) return "badge badge-direct";
    if (ch.includes("airbnb")) return "badge badge-airbnb";
    if (ch.includes("booking")) return "badge badge-booking";
    return "badge badge-other";
  };

  const getChannelColor = (name) => {
    const ch = name.toLowerCase();
    if (ch.includes("direct") || ch.includes("mews")) return "#2d4a3e"; // Forest green
    if (ch.includes("airbnb")) return "#ea580c"; // Airbnb orange
    if (ch.includes("booking")) return "#4f46e5"; // Booking blue
    return "#8eb29d"; // Sage green
  };

  // KPI Calculations
  const totalGrossRevenue = kpis.total_gross_revenue || 0;
  const totalRevenue = kpis.total_net_revenue || 0;
  const totalSpend = kpis.total_spend || 0;
  const roas = kpis.roas || 0.0;
  const newsletterSubs = kpis.newsletter_subscribers || 0;
  const webSessions = kpis.total_sessions || 0;
  const bookingsCount = kpis.total_bookings || 0;
  const convRate = kpis.conversion_rate || 0.0;
  const costPerView = kpis.cost_per_view_7d || 0.0;
  const totalImpressions = kpis.total_impressions || 0;
  const dailySessionsAvg = kpis.daily_sessions_7d || 0.0;
  const checkoutRateAvg = kpis.checkout_rate_7d || 0.0;

  // Helper to trim trailing empty days where there is no traffic or transaction activity
  const trimTrailingEmptyDays = (arr, checkIsEmpty) => {
    let endIdx = arr.length - 1;
    while (endIdx >= 0 && checkIsEmpty(arr[endIdx])) {
      endIdx--;
    }
    return arr.slice(0, endIdx + 1);
  };

  const trendChartClean = trimTrailingEmptyDays(trendChart || [], d => (d.sessions || 0) === 0 && (d.revenue || 0) === 0 && (d.spend || 0) === 0);

  // Render Premium SVG Chart
  const renderSvgChart = () => {
    if (!trendChartClean || trendChartClean.length === 0) {
      return <div style={{ padding: "40px", textAlign: "center" }}>No historical data for this range.</div>;
    }

    const width = 800;
    const height = 280;
    const padding = { top: 20, right: 30, bottom: 40, left: 60 };

    let runningRevenue = 0;
    let runningSpend = 0;
    const cumulativeTrend = trendChartClean.map((d) => {
      runningRevenue += d.revenue || 0;
      runningSpend += d.spend || 0;
      return {
        date: d.date,
        revenue: runningRevenue,
        spend: runningSpend
      };
    });

    const dates = cumulativeTrend.map((d) => d.date);
    const revenues = cumulativeTrend.map((d) => d.revenue);
    const spends = cumulativeTrend.map((d) => d.spend);

    const maxVal = Math.max(...revenues, ...spends, 100);
    const pointsCount = cumulativeTrend.length;

    const getX = (index) => {
      return padding.left + (index * (width - padding.left - padding.right)) / (pointsCount - 1 || 1);
    };

    const getY = (val) => {
      const chartHeight = height - padding.top - padding.bottom;
      return height - padding.bottom - (val / maxVal) * chartHeight;
    };

    // Helper to calculate spectrum color based on daily gross revenue
    const getRevenueColor = (dailyRev) => {
      const rev = Number(dailyRev) || 0;
      if (rev <= 0) return "#ef4444";       // Vivid Red ($0 day)
      if (rev <= 1000) return "#f59e0b";    // Yellow ($1 - $1,000)
      if (rev <= 3000) return "#10b981";    // Green ($1,000 - $3,000)
      if (rev <= 5000) return "#3b82f6";    // Blue ($3,000 - $5,000)
      return "#8b5cf6";                    // Purple (> $5,000)
    };

    // Build SVG paths & multi-stop spectrum gradient stops
    let revenuePathPoints = [];
    let spendPathPoints = [];
    let gradientStops = [];

    cumulativeTrend.forEach((d, index) => {
      const x = getX(index);
      const yRev = getY(d.revenue);
      const ySpend = getY(d.spend);

      revenuePathPoints.push(`${x},${yRev}`);
      spendPathPoints.push(`${x},${ySpend}`);

      // Calculate percentage offset across chart width for smooth gradient blending
      const chartWidth = width - padding.left - padding.right;
      const pct = chartWidth > 0 ? Math.max(0, Math.min(100, ((x - padding.left) / chartWidth) * 100)) : 0;
      const dailyRev = trendChartClean[index] ? (trendChartClean[index].revenue || 0) : 0;
      const color = getRevenueColor(dailyRev);

      gradientStops.push(
        <stop key={`stop-${index}`} offset={`${pct.toFixed(2)}%`} stopColor={color} />
      );
    });

    const revenuePath = pointsCount > 0 ? `M ${revenuePathPoints.join(" L ")}` : "";
    const spendPath = pointsCount > 0 ? `M ${spendPathPoints.join(" L ")}` : "";

    // Build area path for revenue gradient
    const areaPath = pointsCount > 0
      ? `${revenuePath} L ${getX(pointsCount - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`
      : "";

    // Grid lines (y-axis steps)
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
            {formatCurrency(val)}
          </text>
        </g>
      );
    }

    // X-axis date labels (show every few points to avoid crowding)
    const labelStep = Math.max(1, Math.floor(pointsCount / 6));
    const xLabels = [];
    trendChartClean.forEach((d, idx) => {
      if (idx % labelStep === 0 || idx === pointsCount - 1) {
        const x = getX(idx);
        // Format date string (e.g. "2026-06-15" -> "Jun 15")
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

    return (
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto">
          <defs>
            {/* Multi-stop linear gradient blending smoothly along the revenue path */}
            <linearGradient id="revenueSpectrumGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientStops}
            </linearGradient>

            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2d4a3e" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#2d4a3e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines}

          {/* Area under Revenue */}
          {pointsCount > 0 && (
            <path d={areaPath} fill="url(#revenueGrad)" />
          )}

          {/* Axis lines */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#e2e8e4"
            strokeWidth="2"
          />

          {/* Path for Spend */}
          {pointsCount > 0 && (
            <path
              d={spendPath}
              fill="none"
              stroke="#d67a47"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Silky-Smooth Spectrum Gradient Revenue Line */}
          {pointsCount > 0 && (
            <path
              d={revenuePath}
              fill="none"
              stroke="url(#revenueSpectrumGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* X Labels */}
          {xLabels}

          {/* Interactive hover overlays */}
          {trendChartClean.map((d, index) => {
            const x = getX(index);
            const yRev = getY(d.revenue);
            const ySpend = getY(d.spend);

            return (
              <g
                key={`interactive-${index}`}
                onMouseEnter={() => setHoveredData({ ...d, x, yRev, ySpend })}
                onMouseLeave={() => setHoveredData(null)}
                onTouchStart={() => setHoveredData({ ...d, x, yRev, ySpend })}
                style={{ cursor: "pointer" }}
              >
                {/* Invisible hover capture bar */}
                <rect
                  x={x - 10}
                  y={padding.top}
                  width={20}
                  height={height - padding.top - padding.bottom}
                  fill="transparent"
                />

                {/* Highlight dots on hover */}
                {hoveredData?.date === d.date && (
                  <>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={height - padding.bottom}
                      stroke="#e2e8e4"
                      strokeWidth="1.5"
                    />
                    <circle cx={x} cy={yRev} r="6" fill="#2d4a3e" stroke="#fff" strokeWidth="2" />
                    <circle cx={x} cy={ySpend} r="6" fill="#d67a47" stroke="#fff" strokeWidth="2" />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredData && (
          <div
            style={{
              position: "absolute",
              top: `${(hoveredData.yRev / height) * 100}%`,
              left: `${(hoveredData.x / width) * 100}%`,
              transform: "translate(-50%, -105%)",
              backgroundColor: "#2d312e",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "11.5px",
              pointerEvents: "none",
              zIndex: 10,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              border: "1px solid #e2e8e4",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              minWidth: "140px"
            }}
          >
            <div style={{ fontWeight: "600", borderBottom: "1px solid #4a504c", pb: "4px", marginBottom: "4px", fontSize: "11px", color: "#a2aba4" }}>
              {new Date(hoveredData.date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC"
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Revenue:</span>
              <span style={{ fontWeight: "700", color: "#a4cbb9" }}>{formatCurrency(hoveredData.revenue)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Ad Spend:</span>
              <span style={{ fontWeight: "700", color: "#f7b28d" }}>{formatCurrency(hoveredData.spend)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#a2aba4", borderTop: "1px solid #4a504c", marginTop: "2px", paddingTop: "2px" }}>
              <span>Sessions:</span>
              <span>{formatNumber(hoveredData.sessions)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Day of Week Revenue Chart
  const renderDayOfWeekChart = () => {
    const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    let dowData = Array.isArray(revenueByDayOfWeek) && revenueByDayOfWeek.length === 7 ? revenueByDayOfWeek : null;

    // Fallback: Compute DOW metrics dynamically if backend payload wasn't passed or cached
    if (!dowData && trendChartClean && trendChartClean.length > 0) {
      const dayMap = {};
      daysOrder.forEach(d => {
        dayMap[d] = { day: d, short_day: d.slice(0, 3), revenue: 0, gross_revenue: 0, bookings: 0 };
      });

      trendChartClean.forEach(item => {
        if (item.date) {
          try {
            const dt = new Date(item.date + "T00:00:00Z");
            const dayName = dt.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
            if (dayMap[dayName]) {
              dayMap[dayName].revenue += item.revenue || 0;
              dayMap[dayName].bookings += (item.revenue > 0 ? 1 : 0);
            }
          } catch (e) {
            // ignore date parse issues
          }
        }
      });

      const totalRev = Object.values(dayMap).reduce((acc, curr) => acc + curr.revenue, 0);
      dowData = daysOrder.map(d => ({
        ...dayMap[d],
        share: totalRev > 0 ? Number(((dayMap[d].revenue / totalRev) * 100).toFixed(1)) : 0
      }));
    }

    if (!dowData || dowData.length === 0) {
      return (
        <div style={{ padding: "30px", textAlign: "center", color: "#606862" }}>
          No day-of-week revenue data available for this range.
        </div>
      );
    }

    const maxRev = Math.max(...dowData.map(d => d.revenue), 1);
    const totalDowRevenue = dowData.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalDowBookings = dowData.reduce((acc, curr) => acc + curr.bookings, 0);
    const peakDayObj = dowData.reduce((prev, curr) => (curr.revenue > prev.revenue ? curr : prev), dowData[0]);

    // Calculate Weekdays (Mon-Fri) vs Weekends (Sat-Sun) share
    const weekdayRev = dowData.slice(0, 5).reduce((acc, curr) => acc + curr.revenue, 0);
    const weekendRev = dowData.slice(5).reduce((acc, curr) => acc + curr.revenue, 0);
    const weekdayShare = totalDowRevenue > 0 ? ((weekdayRev / totalDowRevenue) * 100).toFixed(1) : 0;
    const weekendShare = totalDowRevenue > 0 ? ((weekendRev / totalDowRevenue) * 100).toFixed(1) : 0;

    return (
      <div className="panel panel-single" style={{ marginTop: "24px" }}>
        <div className="panel-header" style={{ flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div className="panel-title">Revenue Created by Day of the Week</div>
            <div style={{ fontSize: "12.5px", color: "#606862", marginTop: "2px" }}>
              Total net booking revenue generated across all 7 days of the week to date
            </div>
          </div>
          {peakDayObj && peakDayObj.revenue > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#f0f4f1",
              border: "1px solid #d0ded5",
              color: "#2d4a3e",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 600
            }}>
              <span>🏆 Peak Booking Day:</span>
              <strong style={{ color: "#2d4a3e" }}>{peakDayObj.day} ({formatCurrency(peakDayObj.revenue)} • {peakDayObj.share}%)</strong>
            </div>
          )}
        </div>

        {/* 7-Day Visual Bar Chart */}
        <div style={{ marginTop: "24px", marginBottom: "16px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: isMobile ? "6px" : "16px",
            alignItems: "flex-end",
            height: "220px",
            padding: "16px 12px 8px 12px",
            backgroundColor: "#fafbfa",
            borderRadius: "12px",
            border: "1px solid #e2e8e4"
          }}>
            {dowData.map((d) => {
              const heightPct = maxRev > 0 ? Math.max(8, (d.revenue / maxRev) * 100) : 8;
              const isPeak = d.day === peakDayObj.day && d.revenue > 0;
              const isHovered = hoveredDow?.day === d.day;

              return (
                <div
                  key={d.day}
                  onMouseEnter={() => setHoveredDow(d)}
                  onMouseLeave={() => setHoveredDow(null)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    height: "100%",
                    justifyContent: "flex-end",
                    cursor: "pointer",
                    position: "relative"
                  }}
                >
                  {/* Top Revenue & Share Labels */}
                  <div style={{
                    fontSize: isMobile ? "10px" : "11px",
                    fontWeight: 700,
                    color: isPeak ? "#2d4a3e" : "#606862",
                    marginBottom: "6px",
                    textAlign: "center",
                    lineHeight: 1.2
                  }}>
                    <div>{d.revenue > 0 ? formatCurrency(d.revenue) : "$0"}</div>
                    <div style={{ fontSize: "10px", fontWeight: 500, color: "#8a948c", marginTop: "1px" }}>
                      {d.share}%
                    </div>
                  </div>

                  {/* Vertical Bar track */}
                  <div style={{
                    width: "100%",
                    maxWidth: isMobile ? "28px" : "48px",
                    height: "130px",
                    backgroundColor: "#eef2ef",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "flex-end",
                    overflow: "hidden",
                    border: isHovered ? "2px solid #2d4a3e" : (isPeak ? "1px solid #a8c4b4" : "1px solid transparent"),
                    boxShadow: isHovered ? "0 4px 12px rgba(45, 74, 62, 0.15)" : "none",
                    transition: "all 0.2s ease"
                  }}>
                    {/* Inner Colored Bar Fill */}
                    <div style={{
                      width: "100%",
                      height: `${heightPct}%`,
                      background: isPeak
                        ? "linear-gradient(180deg, #2d4a3e 0%, #436b5b 100%)"
                        : (d.revenue > 0 ? "linear-gradient(180deg, #5f7a61 0%, #8eb29d 100%)" : "#d8dfda"),
                      borderRadius: "6px 6px 0 0",
                      transition: "height 0.4s ease, background 0.2s ease"
                    }} />
                  </div>

                  {/* Day Label Pill */}
                  <div style={{
                    marginTop: "10px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: isMobile ? "11px" : "12px",
                    fontWeight: isPeak || isHovered ? 700 : 600,
                    backgroundColor: isPeak ? "#2d4a3e" : (isHovered ? "#e2e8e4" : "transparent"),
                    color: isPeak ? "#ffffff" : "#2d312e",
                    transition: "all 0.2s ease"
                  }}>
                    {isMobile ? d.short_day : d.day}
                  </div>

                  {/* Absolute Floating Tooltip (No Layout Reflow) */}
                  {isHovered && (
                    <div style={{
                      position: "absolute",
                      bottom: "100%",
                      left: "50%",
                      transform: "translate(-50%, -10px)",
                      backgroundColor: "#2d312e",
                      color: "#ffffff",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      zIndex: 30,
                      boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                      border: "1px solid #4a504c",
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px"
                    }}>
                      <div style={{ fontWeight: "700", color: "#a4cbb9", fontSize: "11px", borderBottom: "1px solid #4a504c", paddingBottom: "3px" }}>
                        {d.day}
                      </div>
                      <div>Net Revenue: <strong style={{ color: "#ffffff" }}>{formatCurrency(d.revenue)}</strong></div>
                      {d.gross_revenue > 0 && <div>Gross: <strong style={{ color: "#d2e4db" }}>{formatCurrency(d.gross_revenue)}</strong></div>}
                      <div>Bookings: <strong style={{ color: "#ffffff" }}>{formatNumber(d.bookings)}</strong></div>
                      <div>Share of Total: <strong style={{ color: "#f7b28d" }}>{d.share}%</strong></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Summary Breakdown Cards (Always Static) */}
        <div className="mobile-two-col" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginTop: "16px"
        }}>
          <div style={{
            padding: "14px 16px",
            backgroundColor: "#fafbfa",
            border: "1px solid #e2e8e4",
            borderRadius: "8px"
          }}>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#606862", marginBottom: "4px" }}>
              🏆 Highest Revenue Day
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#2d4a3e" }}>
              {peakDayObj ? peakDayObj.day : "N/A"}
            </div>
            <div style={{ fontSize: "12px", color: "#606862", marginTop: "2px" }}>
              {peakDayObj ? `${formatCurrency(peakDayObj.revenue)} (${peakDayObj.share}% share)` : "$0"}
            </div>
          </div>

          <div style={{
            padding: "14px 16px",
            backgroundColor: "#fafbfa",
            border: "1px solid #e2e8e4",
            borderRadius: "8px"
          }}>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#606862", marginBottom: "4px" }}>
              📅 Weekdays vs. Weekends
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#2d312e" }}>
              {weekdayShare}% / {weekendShare}%
            </div>
            <div style={{ fontSize: "12px", color: "#606862", marginTop: "2px" }}>
              Mon–Fri ({formatCurrency(weekdayRev)}) vs. Sat–Sun ({formatCurrency(weekendRev)})
            </div>
          </div>

          <div style={{
            padding: "14px 16px",
            backgroundColor: "#fafbfa",
            border: "1px solid #e2e8e4",
            borderRadius: "8px"
          }}>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#606862", marginBottom: "4px" }}>
              📊 Daily Average Revenue
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#d67a47" }}>
              {formatCurrency(totalDowRevenue / 7)}
            </div>
            <div style={{ fontSize: "12px", color: "#606862", marginTop: "2px" }}>
              Across 7 day-of-week buckets ({formatNumber(totalDowBookings)} bookings)
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Gross Revenue</div>
          <div className="kpi-value">{formatCurrency(totalGrossRevenue)}</div>
          <div className="kpi-subtext">Before OTA commissions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Net Revenue</div>
          <div className="kpi-value">{formatCurrency(totalRevenue)}</div>
          <div className="kpi-subtext">Across all booking channels</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Bookings Count</div>
          <div className="kpi-value">{formatNumber(bookingsCount)}</div>
          <div className="kpi-subtext">Total reservations loaded</div>
        </div>

        {!isMobile && (
          <div className="kpi-card">
            <div className="kpi-label">Subscribers</div>
            <div className="kpi-value">{formatNumber(newsletterSubs)}</div>
            <div className="kpi-subtext">Squarespace newsletter list</div>
          </div>
        )}

        <div className="kpi-card">
          <div className="kpi-label">Total Ad Spend</div>
          <div className="kpi-value orange">{formatCurrency(totalSpend)}</div>
          <div className="kpi-subtext">Google: {formatCurrency(kpis.google_spend || 0)} | Meta: {formatCurrency(kpis.meta_spend || 0)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">ROAS</div>
          <div className="kpi-value">{roas.toFixed(2)}x</div>
          <div className="kpi-subtext">Mews Revenue ÷ Ad Spend</div>
        </div>

        {!isMobile && (
          <>
            <div className="kpi-card">
              <div className="kpi-label">Cost per Landing Page View</div>
              <div className="kpi-value">{costPerView > 0 ? `$${costPerView.toFixed(2)}` : "$0.00"}</div>
              <div className="kpi-subtext">7-day moving average (Google + Meta)</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Total Ad Impressions</div>
              <div className="kpi-value">{formatNumber(totalImpressions)}</div>
              <div className="kpi-subtext">Google & Meta combined</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Daily Sessions</div>
              <div className="kpi-value">{dailySessionsAvg.toFixed(1)}</div>
              <div className="kpi-subtext">7-day moving average (GA4)</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Checkout Rate</div>
              <div className="kpi-value">{checkoutRateAvg.toFixed(1)}%</div>
              <div className="kpi-subtext">7-day moving average (GA4 → Mews)</div>
            </div>
          </>
        )}
      </div>

      {/* Channel Revenue Share Breakdown */}
      <div className="panel" style={{ marginBottom: "24px" }}>
        <div className="panel-header">
          <div className="panel-title">Net Revenue Share by Booking Channel</div>
        </div>
        
        {channelSummary.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#606862" }}>
            No booking records found. Upload a Mews export to get started!
          </div>
        ) : (
          <div>
            {/* Stacked Percentage Bar Graph */}
            <div style={{ 
              display: "flex", 
              height: "28px", 
              width: "100%", 
              borderRadius: "14px", 
              overflow: "hidden", 
              backgroundColor: "#f4f6f5", 
              marginBottom: "24px" 
            }}>
              {channelSummary.map((sum) => {
                const totalNet = channelSummary.reduce((acc, curr) => acc + curr.net, 0);
                const share = totalNet > 0 ? (sum.net / totalNet) * 100 : 0;
                if (share <= 0) return null;
                return (
                  <div 
                    key={sum.name}
                    style={{ 
                      width: `${share}%`, 
                      backgroundColor: getChannelColor(sum.name),
                      height: "100%",
                      transition: "width 0.3s ease"
                    }}
                    title={`${sum.name}: ${share.toFixed(1)}%`}
                  />
                );
              })}
            </div>

            {/* Channel Cards Grid */}
            <div className="mobile-two-col" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
              {channelSummary.map((sum) => {
                const totalNet = channelSummary.reduce((acc, curr) => acc + curr.net, 0);
                const share = totalNet > 0 ? (sum.net / totalNet) * 100 : 0;
                const avgFee = sum.gross > 0 ? ((sum.gross - sum.net) / sum.gross * 100) : 0;
                const color = getChannelColor(sum.name);

                return (
                  <div 
                    key={sum.name} 
                    style={{ 
                      padding: "16px", 
                      border: `1px solid #e2e8e4`, 
                      borderLeft: `4px solid ${color}`,
                      borderRadius: "8px",
                      backgroundColor: "#fafbfa"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span className={getChannelBadgeClass(sum.name)}>{sum.name}</span>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#606862" }}>
                        {share.toFixed(1)}% share
                      </span>
                    </div>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: "#2d312e", marginBottom: "4px" }}>
                      {formatCurrency(sum.net)}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#606862" }}>
                      <strong>{formatNumber(sum.count)}</strong> bookings • {formatCurrency(sum.gross)} gross
                    </div>
                    {avgFee > 0 && (
                      <div style={{ fontSize: "11.5px", color: "#d67a47", marginTop: "6px", fontWeight: 500 }}>
                        Avg. Fee: {avgFee.toFixed(1)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Charts & Key Metrics */}
      <div className="panel panel-single">
        <div className="panel-header">
          <div className="panel-title">Cumulative Net Revenue vs. Advertising Spend</div>
          <div className="channel-spend-legend" style={{ margin: 0 }}>
            <div className="legend-item">
              <span className="legend-dot revenue"></span>
              <span style={{ fontWeight: 500 }}>Net Booking Revenue</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot spend"></span>
              <span style={{ fontWeight: 500 }}>Total Ad Spend</span>
            </div>
          </div>
        </div>
        {renderSvgChart()}
      </div>

      {/* Revenue Created by Day of the Week Chart */}
      {renderDayOfWeekChart()}
    </div>
  );
}
