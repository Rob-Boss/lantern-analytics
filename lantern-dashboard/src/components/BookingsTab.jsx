import React, { useState } from "react";

export default function BookingsTab({ bookingsData, loading }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");

  if (loading) {
    return <div style={{ padding: "80px", textAlign: "center", color: "#606862" }}>Loading Bookings ledger...</div>;
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

  // Filter bookings by search and channel
  const filteredBookings = bookings.filter((b) => {
    const guestEmail = b.guest_email || "";
    const guestName = b.guest_name || "";
    const bookingId = b.id || "";
    const normChannel = b.normalized_channel || "Other";

    const matchesSearch = 
      bookingId.toLowerCase().includes(searchQuery.toLowerCase()) || 
      guestEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guestName.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesChannel = 
      channelFilter === "all" || 
      normChannel.toLowerCase() === channelFilter.toLowerCase();
      
    return matchesSearch && matchesChannel;
  });

  // Calculate filtered totals for operational booking cards
  const totalNights = filteredBookings.reduce((acc, b) => acc + (b.nights || 0), 0);
  const totalGross = filteredBookings.reduce((acc, b) => acc + (b.gross_revenue || 0), 0);
  const avgBookingValue = filteredBookings.length > 0 ? (totalGross / filteredBookings.length) : 0;
  const avgStay = filteredBookings.length > 0 ? (totalNights / filteredBookings.length) : 0;

  // No pagination: render all filtered rows directly

  const getChannelBadgeClass = (channel) => {
    const ch = (channel || "").toLowerCase();
    if (ch.includes("direct") || ch.includes("mews")) return "badge badge-direct";
    if (ch.includes("airbnb")) return "badge badge-airbnb";
    if (ch.includes("booking")) return "badge badge-booking";
    return "badge badge-other";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const dateObj = new Date(dateStr + "T00:00:00");
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Ledger Operational Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8e4", borderRadius: "10px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "11px", color: "#606862", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "4px" }}>LEDGER BOOKINGS COUNT</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#2d312e" }}>{formatNumber(filteredBookings.length)}</div>
          <div style={{ fontSize: "11px", color: "#8a928c", marginTop: "4px" }}>Matching filters</div>
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8e4", borderRadius: "10px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "11px", color: "#606862", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "4px" }}>TOTAL NIGHTS BOOKED</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#2d4a3e" }}>{formatNumber(totalNights)}</div>
          <div style={{ fontSize: "11px", color: "#8a928c", marginTop: "4px" }}>Sum of stay durations</div>
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8e4", borderRadius: "10px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "11px", color: "#606862", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "4px" }}>AVERAGE STAY LENGTH</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#2d312e" }}>{avgStay.toFixed(1)} <span style={{ fontSize: "15px", fontWeight: "500", color: "#606862" }}>nights</span></div>
          <div style={{ fontSize: "11px", color: "#8a928c", marginTop: "4px" }}>Average nights per booking</div>
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8e4", borderRadius: "10px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ fontSize: "11px", color: "#606862", fontWeight: "600", letterSpacing: "0.05em", marginBottom: "4px" }}>AVG BOOKING VALUE (GROSS)</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#d67a47" }}>{formatCurrency(avgBookingValue)}</div>
          <div style={{ fontSize: "11px", color: "#8a928c", marginTop: "4px" }}>Average gross value per stay</div>
        </div>
      </div>

      {/* Ledger Table Panel */}
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div className="panel-title">Mews Bookings Ledger</div>
          
          {/* Controls */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <input 
              type="text" 
              placeholder="Search guest name, email, or reservation ID..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #e2e8e4",
                fontSize: "12.5px",
                minWidth: "260px",
                outline: "none"
              }}
            />
            
            <select
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value); }}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #e2e8e4",
                fontSize: "12.5px",
                backgroundColor: "#ffffff",
                outline: "none"
              }}
            >
              <option value="all">All Channels</option>
              <option value="mews booking engine">Mews Booking Engine</option>
              <option value="airbnb">Airbnb</option>
              <option value="booking.com">Booking.com</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#606862" }}>
            No booking records match the selected filters.
          </div>
        ) : (
          <div>
            {/* Table wrapper */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8e4", color: "#606862", fontWeight: "600" }}>
                    <th style={{ padding: "12px 8px" }}>Booking Date</th>
                    <th style={{ padding: "12px 8px" }}>Stay Dates</th>
                    <th style={{ padding: "12px 8px" }}>Reservation ID</th>
                    <th style={{ padding: "12px 8px" }}>Guest</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Nights</th>
                    <th style={{ padding: "12px 8px" }}>Channel Source</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Gross</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Fee %</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>Net Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => {
                    return (
                      <tr 
                        key={b.id} 
                        style={{ 
                          borderBottom: "1px solid #f0f3f1", 
                          height: "48px",
                          backgroundColor: "#ffffff"
                        }}
                        className="ledger-row"
                      >
                        <td style={{ padding: "10px 8px", whiteSpace: "nowrap", fontWeight: "500", color: "#2d312e" }}>
                          {formatDate(b.booking_date)}
                        </td>
                        <td style={{ padding: "10px 8px", whiteSpace: "nowrap", color: "#2d312e" }}>
                          {b.check_in_date && b.check_out_date ? (
                            <span style={{ fontWeight: "500" }}>{formatDate(b.check_in_date)} – {formatDate(b.check_out_date)}</span>
                          ) : b.check_in_date ? (
                            <span>{formatDate(b.check_in_date)} (check-in)</span>
                          ) : "-"}
                        </td>
                        <td style={{ padding: "10px 8px", fontFamily: "monospace", color: "#606862", fontSize: "12px" }}>
                          {b.id}
                        </td>
                        <td style={{ padding: "10px 8px", color: "#2d312e" }}>
                          <div style={{ fontWeight: "600" }}>{b.guest_name || "-"}</div>
                          <div style={{ fontSize: "11px", color: "#606862" }}>{b.guest_email || "-"}</div>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: "500" }}>
                          {b.nights}
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span className={getChannelBadgeClass(b.normalized_channel)} style={{ alignSelf: "flex-start" }}>
                              {b.normalized_channel}
                            </span>
                            {b.channel && b.channel.toLowerCase() !== b.normalized_channel.toLowerCase() && (
                              <span style={{ fontSize: "10px", color: "#8a928c", wordBreak: "break-all" }}>
                                {b.channel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right", color: "#606862" }}>
                          {formatCurrency(b.gross_revenue)}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right", color: "#d67a47", fontWeight: "500" }}>
                          {b.ota_fee_percent > 0 ? `${b.ota_fee_percent.toFixed(1)}%` : "0.0%"}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "600", color: "#2d4a3e" }}>
                          {formatCurrency(b.net_revenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Ledger Match Indicator */}
            <div style={{ marginTop: "20px", borderTop: "1px solid #e2e8e4", paddingTop: "16px", fontSize: "12px", color: "#606862" }}>
              Showing <strong>{filteredBookings.length}</strong> bookings matching active filters.
            </div>
          </div>
        )}
      </div>
      
      {/* Dynamic styling for table row highlights on hover */}
      <style>{`
        .ledger-row:hover {
          background-color: #f7faf8 !important;
        }
      `}</style>
    </div>
  );
}
