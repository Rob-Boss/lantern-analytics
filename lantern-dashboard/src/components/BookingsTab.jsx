import React, { useState } from "react";

export default function BookingsTab({ bookingsData, loading }) {
  const [channelFilter, setChannelFilter] = useState("all");

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading Bookings ledger...</div>;
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

  const bookings = bookingsData.bookings || [];
  const channelSummary = bookingsData.channel_summary || [];

  // Filter bookings by channel
  const filteredBookings = channelFilter === "all" 
    ? bookings 
    : bookings.filter((b) => b.channel.toLowerCase() === channelFilter.toLowerCase());

  // Get unique channels for the filter dropdown
  const channelsList = Array.from(new Set(bookings.map((b) => b.channel)));

  const getChannelBadgeClass = (channel) => {
    const ch = channel.toLowerCase();
    if (ch.includes("direct")) return "badge badge-direct";
    if (ch.includes("airbnb")) return "badge badge-airbnb";
    if (ch.includes("booking")) return "badge badge-booking";
    return "badge badge-other";
  };

  const totalNet = channelSummary.reduce((acc, curr) => acc + curr.net, 0);

  const getChannelColor = (name) => {
    const ch = name.toLowerCase();
    if (ch.includes("direct")) return "#2d4a3e"; // Forest green
    if (ch.includes("airbnb")) return "#ea580c"; // Airbnb orange
    if (ch.includes("booking")) return "#4f46e5"; // Booking blue
    return "#8eb29d"; // Sage green
  };

  return (
    <div>
      {/* Channel Aggregate Summary */}
      <div className="panel" style={{ marginBottom: "24px" }}>
        <div className="panel-header">
          <div className="panel-title">Net Revenue Share by Booking Channel</div>
        </div>
        
        {channelSummary.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>No booking records found. Upload a Mews export to get started!</div>
        ) : (
          <div>
            {/* Horizontal Stacked Percentage Bar Graph */}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
              {channelSummary.map((sum) => {
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
    </div>
  );
}
