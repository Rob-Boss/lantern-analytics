import React from "react";

export default function AdsTab({ adsData, loading }) {
  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading Ads metrics...</div>;
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

  const renderAdsChart = () => {
    if (!dailyBreakdown || dailyBreakdown.length === 0) {
      return <div style={{ padding: "40px", textAlign: "center" }}>No ad activity cached in this range.</div>;
    }

    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };

    const googleSpendList = dailyBreakdown.map((d) => d.google_spend || 0);
    const metaSpendList = dailyBreakdown.map((d) => d.meta_spend || 0);
    const maxVal = Math.max(...googleSpendList, ...metaSpendList, 10);
    const pointsCount = dailyBreakdown.length;

    const getX = (index) => {
      return padding.left + (index * (width - padding.left - padding.right)) / (pointsCount - 1 || 1);
    };

    const getY = (val) => {
      const chartHeight = height - padding.top - padding.bottom;
      return height - padding.bottom - (val / maxVal) * chartHeight;
    };

    let googlePoints = [];
    let metaPoints = [];

    dailyBreakdown.forEach((d, index) => {
      const x = getX(index);
      const yGov = getY(d.google_spend || 0);
      const yMet = getY(d.meta_spend || 0);

      googlePoints.push(`${x},${yGov}`);
      metaPoints.push(`${x},${yMet}`);
    });

    const googlePath = pointsCount > 0 ? `M ${googlePoints.join(" L ")}` : "";
    const metaPath = pointsCount > 0 ? `M ${metaPoints.join(" L ")}` : "";

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
            {formatCurrency(val)}
          </text>
        </g>
      );
    }

    // X-axis date labels
    const labelStep = Math.max(1, Math.floor(pointsCount / 6));
    const xLabels = [];
    dailyBreakdown.forEach((d, idx) => {
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
            <span style={{ display: "inline-block", width: "12px", height: "3px", backgroundColor: "#4f46e5" }}></span>
            <span style={{ color: "#606862" }}>Google Ads</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ display: "inline-block", width: "12px", height: "3px", backgroundColor: "#ea580c" }}></span>
            <span style={{ color: "#606862" }}>Meta Ads</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto">
          {/* Grid lines */}
          {gridLines}
          
          {/* Google Ads Line */}
          {googlePath && (
            <path
              d={googlePath}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Meta Ads Line */}
          {metaPath && (
            <path
              d={metaPath}
              fill="none"
              stroke="#ea580c"
              strokeWidth="2.5"
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

      {/* Daily Spend Chart */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Daily Advertising Spend Trend</div>
        </div>
        <div style={{ marginTop: "16px" }}>
          {renderAdsChart()}
        </div>
      </div>
    </div>
  );
}
