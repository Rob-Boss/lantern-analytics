import React, { useState } from "react";

export default function OverviewTab({ kpis, trendChart, loading }) {
  const [hoveredData, setHoveredData] = useState(null);

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

  // KPI Calculations
  const totalRevenue = kpis.total_net_revenue || 0;
  const totalSpend = kpis.total_spend || 0;
  const roas = kpis.roas || 0.0;
  const newsletterSubs = kpis.newsletter_subscribers || 0;
  const webSessions = kpis.total_sessions || 0;
  const bookingsCount = kpis.total_bookings || 0;
  const convRate = kpis.conversion_rate || 0.0;

  // Render Premium SVG Chart
  const renderSvgChart = () => {
    if (!trendChart || trendChart.length === 0) {
      return <div style={{ padding: "40px", textAlign: "center" }}>No historical data for this range.</div>;
    }

    const width = 800;
    const height = 280;
    const padding = { top: 20, right: 30, bottom: 40, left: 60 };

    let runningRevenue = 0;
    let runningSpend = 0;
    const cumulativeTrend = trendChart.map((d) => {
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

    // Build SVG paths
    let revenuePathPoints = [];
    let spendPathPoints = [];

    cumulativeTrend.forEach((d, index) => {
      const x = getX(index);
      const yRev = getY(d.revenue);
      const ySpend = getY(d.spend);

      revenuePathPoints.push(`${x},${yRev}`);
      spendPathPoints.push(`${x},${ySpend}`);
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
    trendChart.forEach((d, idx) => {
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
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2d4a3e" stopOpacity="0.15" />
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

          {/* Path for Revenue */}
          {pointsCount > 0 && (
            <path
              d={revenuePath}
              fill="none"
              stroke="#2d4a3e"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}

          {/* X Labels */}
          {xLabels}

          {/* Interactive hover overlays */}
          {trendChart.map((d, index) => {
            const x = getX(index);
            const yRev = getY(d.revenue);
            const ySpend = getY(d.spend);

            return (
              <g
                key={`interactive-${index}`}
                onMouseEnter={() => setHoveredData({ ...d, x, yRev, ySpend })}
                onMouseLeave={() => setHoveredData(null)}
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
              top: `${hoveredData.yRev - 80}px`,
              left: `${(hoveredData.x / width) * 100}%`,
              transform: "translateX(-50%)",
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

  return (
    <div>
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Net Revenue</div>
          <div className="kpi-value">{formatCurrency(totalRevenue)}</div>
          <div className="kpi-subtext">Across all booking channels</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Ad Spend</div>
          <div className="kpi-value orange">{formatCurrency(totalSpend)}</div>
          <div className="kpi-subtext">Google: {formatCurrency(kpis.google_spend || 0)} | Meta: {formatCurrency(kpis.meta_spend || 0)}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">ROAS</div>
          <div className="kpi-value">{roas.toFixed(2)}x</div>
          <div className="kpi-subtext">Revenue ÷ Ad Spend</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Bookings Count</div>
          <div className="kpi-value">{formatNumber(bookingsCount)}</div>
          <div className="kpi-subtext">Total reservations loaded</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Web Sessions</div>
          <div className="kpi-value">{formatNumber(webSessions)}</div>
          <div className="kpi-subtext">Total visits from GA4</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Conversion Rate</div>
          <div className="kpi-value">{convRate.toFixed(2)}%</div>
          <div className="kpi-subtext">Bookings ÷ Web Sessions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Newsletter List</div>
          <div className="kpi-value">{formatNumber(newsletterSubs)}</div>
          <div className="kpi-subtext">Subscribers (Squarespace)</div>
        </div>
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
    </div>
  );
}
