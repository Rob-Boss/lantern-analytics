import React from "react";

export default function TrafficTab({ trafficData, loading }) {
  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading traffic data...</div>;
  }

  const formatNumber = (val) => {
    return new Intl.NumberFormat("en-US").format(val || 0);
  };

  const summary = trafficData.summary || { sessions: 0, pageviews: 0, checkouts_initiated: 0 };
  const funnel = trafficData.funnel || { sessions: 0, checkouts: 0, purchases: 0, checkout_conv_rate: 0, booking_conv_rate: 0 };
  const dailyTraffic = trafficData.daily_traffic || [];

  // Funnel details
  const sessions = funnel.sessions || 0;
  const checkouts = funnel.checkouts || 0;
  const purchases = funnel.purchases || 0;

  const checkoutPercentage = sessions > 0 ? (checkouts / sessions) * 100 : 0;
  const purchasePercentage = sessions > 0 ? (purchases / sessions) * 100 : 0;
  const checkoutToPurchase = checkouts > 0 ? (purchases / checkouts) * 100 : 0;

  const renderTrafficChart = () => {
    if (!dailyTraffic || dailyTraffic.length === 0) {
      return <div style={{ padding: "40px", textAlign: "center" }}>No traffic metrics cached in this range.</div>;
    }

    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };

    const sessionsList = dailyTraffic.map((d) => d.sessions || 0);
    const maxVal = Math.max(...sessionsList, 10);
    const pointsCount = dailyTraffic.length;

    const getX = (index) => {
      return padding.left + (index * (width - padding.left - padding.right)) / (pointsCount - 1 || 1);
    };

    const getY = (val) => {
      const chartHeight = height - padding.top - padding.bottom;
      return height - padding.bottom - (val / maxVal) * chartHeight;
    };

    let sessionsPoints = [];
    let checkoutsPoints = [];

    dailyTraffic.forEach((d, index) => {
      const x = getX(index);
      const ySess = getY(d.sessions || 0);
      const yChk = getY(d.checkouts || 0);

      sessionsPoints.push(`${x},${ySess}`);
      checkoutsPoints.push(`${x},${yChk}`);
    });

    const sessionsPath = pointsCount > 0 ? `M ${sessionsPoints.join(" L ")}` : "";
    const checkoutsPath = pointsCount > 0 ? `M ${checkoutsPoints.join(" L ")}` : "";

    const areaPath = pointsCount > 0
      ? `${sessionsPath} L ${getX(pointsCount - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`
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

    return (
      <div style={{ position: "relative" }}>
        <div className="chart-legend" style={{ display: "flex", gap: "16px", justifyContent: "flex-end", marginBottom: "12px", fontSize: "11px", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "4px", backgroundColor: "#8eb29d" }}></span>
            <span style={{ color: "#606862" }}>Sessions</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "2px", backgroundColor: "#d67a47" }}></span>
            <span style={{ color: "#606862" }}>Checkouts Initiated</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto">
          <defs>
            <linearGradient id="sessionsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8eb29d" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8eb29d" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {gridLines}
          
          {/* Area fill under sessions */}
          {areaPath && (
            <path d={areaPath} fill="url(#sessionsGrad)" />
          )}
          
          {/* Sessions line */}
          {sessionsPath && (
            <path
              d={sessionsPath}
              fill="none"
              stroke="#8eb29d"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Checkouts line */}
          {checkoutsPath && (
            <path
              d={checkoutsPath}
              fill="none"
              stroke="#d67a47"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

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
        </svg>
      </div>
    );
  };

  return (
    <div>
      {/* Overview Cards & Funnel */}
      <div className="panel-grid" style={{ gridTemplateColumns: "1fr 1.2fr", marginBottom: "24px" }}>
        
        {/* KPI Summaries */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="panel">
            <div className="panel-header" style={{ marginBottom: "12px" }}>
              <div className="panel-title">Traffic Volume</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>TOTAL SESSIONS</div>
                <div style={{ fontSize: "32px", fontWeight: "700", color: "#2d4a3e" }}>{formatNumber(summary.sessions)}</div>
              </div>
              <div style={{ borderLeft: "1px solid #e2e8e4", paddingLeft: "24px" }}>
                <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>TOTAL PAGEVIEWS</div>
                <div style={{ fontSize: "32px", fontWeight: "700", color: "#606862" }}>{formatNumber(summary.pageviews)}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header" style={{ marginBottom: "12px" }}>
              <div className="panel-title">Conversion Ratios</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>SESSIONS TO CHECKOUT</div>
                <div style={{ fontSize: "22px", fontWeight: "700", color: "#2d312e" }}>{(funnel.checkout_conv_rate || 0).toFixed(2)}%</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "#606862", fontWeight: 500 }}>CHECKOUT TO BOOKING</div>
                <div style={{ fontSize: "22px", fontWeight: "700", color: "#2d4a3e" }}>{(checkoutToPurchase || 0).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Traffic Trend Chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Daily Web Traffic Trend</div>
          </div>
          <div style={{ marginTop: "16px" }}>
            {renderTrafficChart()}
          </div>
        </div>
      </div>


    </div>
  );
}
