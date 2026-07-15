import React, { useState, useEffect, useRef } from "react";

const CABINS = [
  { id: "w9W2aH", cabinName: "Field Cabin 1 (Accessible)", doorCode: "3401", type: "Field" },
  { id: "x5X6bJ", cabinName: "Field Cabin 2", doorCode: "3402", type: "Field" },
  { id: "y1Y8cK", cabinName: "Field Cabin 3", doorCode: "3403", type: "Field" },
  { id: "z6Z4dL", cabinName: "Field Cabin 4", doorCode: "3404", type: "Field" },
  { id: "b2A8eM", cabinName: "Field Cabin 5", doorCode: "3405", type: "Field" },
  { id: "d7B3fN", cabinName: "Field Cabin 6", doorCode: "3406", type: "Field" },
  { id: "f3C8gP", cabinName: "Field Cabin 7", doorCode: "3407", type: "Field" },
  { id: "h8D4hQ", cabinName: "Field Cabin 8", doorCode: "3408", type: "Field" },
  { id: "j9E2jR", cabinName: "Field Cabin 9", doorCode: "3409", type: "Field" },
  { id: "k5F7kS", cabinName: "Field Cabin 10", doorCode: "3410", type: "Field" },
  { id: "m2G8mT", cabinName: "Field Cabin 11", doorCode: "3411", type: "Field" },
  { id: "n6H4nV", cabinName: "Field Cabin 12", doorCode: "3412", type: "Field" },
  { id: "a7B2xD", cabinName: "Forest Cabin 13", doorCode: "3601", type: "Forest" },
  { id: "c3F9qZ", cabinName: "Forest Cabin 14", doorCode: "3602", type: "Forest" },
  { id: "e8K1wY", cabinName: "Forest Cabin 15", doorCode: "3603", type: "Forest" },
  { id: "g4V6pX", cabinName: "Forest Cabin 16", doorCode: "3604", type: "Forest" },
  { id: "j9M2rL", cabinName: "Forest Cabin 17", doorCode: "3605", type: "Forest" },
  { id: "k5N7sT", cabinName: "Forest Cabin 18", doorCode: "3606", type: "Forest" },
  { id: "m2P8uB", cabinName: "Forest Cabin 19", doorCode: "3607", type: "Forest" },
  { id: "n6Q4vC", cabinName: "Forest Cabin 20", doorCode: "3608", type: "Forest" },
  { id: "p1R9wD", cabinName: "Forest Cabin 21", doorCode: "3609", type: "Forest" },
  { id: "r7S3xE", cabinName: "Forest Cabin 22", doorCode: "3610", type: "Forest" },
  { id: "t3T8yF", cabinName: "Forest Cabin 23", doorCode: "3611", type: "Forest" },
  { id: "v8U4zG", cabinName: "Forest Cabin 24", doorCode: "3612", type: "Forest" },
];

const normalizeText = (text) => (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const findMatchingCabin = (spaceStr) => {
  if (!spaceStr) return "";
  const norm = normalizeText(spaceStr);
  
  // 1. Try exact or direct inclusion match
  for (const c of CABINS) {
    const normName = normalizeText(c.cabinName);
    if (normName.includes(norm) || norm.includes(normName)) {
      return c.cabinName;
    }
  }
  
  // 2. Extract number from input string and match exactly
  const numMatch = spaceStr.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    const isForest = norm.includes("forest") || num >= 13;
    
    const match = CABINS.find(c => {
      const cNumMatch = c.cabinName.match(/\d+/);
      const cNum = cNumMatch ? parseInt(cNumMatch[0], 10) : null;
      return cNum === num && c.type === (isForest ? "Forest" : "Field");
    });
    
    if (match) return match.cabinName;
  }
  
  return "";
};

const getLocalDateString = (offsetDays = 0) => {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AirbnbWaiverHelper({ apiBase }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  
  // Inline cabin overrides
  const [cabinSelection, setCabinSelection] = useState({});
  
  // Copy status triggers
  const [copiedId, setCopiedId] = useState(null);
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  
  // Template configurations
  const [template, setTemplate] = useState(
    "Hi {firstName} ⛺ We are looking forward to welcoming you to Lantern Camp. Before you arrive, please check in and sign our guest waiver here: {checkinUrl} — Once signed, you'll receive your cabin gate code. Let us know if you have any questions."
  );
  
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch bookings without date constraints to get future bookings as well
      const res = await fetch(`${apiBase}/dashboard/bookings`);
      if (!res.ok) throw new Error("Failed to load bookings ledger");
      const data = await res.json();
      
      const fetchedBookings = data.bookings || [];
      setBookings(fetchedBookings);
      
      // Auto-detect cabins from DB space fields
      const initialCabinSelection = {};
      fetchedBookings.forEach(b => {
        if (b.cabin_name) {
          const match = findMatchingCabin(b.cabin_name);
          if (match) {
            initialCabinSelection[b.id] = match;
          }
        }
      });
      setCabinSelection(initialCabinSelection);
    } catch (err) {
      console.error(err);
      setError("Failed to query bookings database. Check connection or server status.");
    } finally {
      setLoading(false);
    }
  };

  const handleCabinChange = (bookingId, cabinName) => {
    setCabinSelection(prev => ({
      ...prev,
      [bookingId]: cabinName
    }));
  };

  const getGuestDetails = (b) => {
    const fullName = b.guest_name || "Guest";
    const firstName = fullName.split(" ")[0] || "there";
    const selectedCabinName = cabinSelection[b.id] || "";
    const cabinObj = CABINS.find(c => c.cabinName === selectedCabinName);
    const checkinUrl = cabinObj ? `https://checkin.lanterncamp.com/${cabinObj.id}` : "";
    
    return { fullName, firstName, selectedCabinName, checkinUrl };
  };

  const getFormattedMessage = (b) => {
    const { fullName, firstName, selectedCabinName, checkinUrl } = getGuestDetails(b);
    
    if (!selectedCabinName) {
      return "Please select a cabin first to generate the waiver URL.";
    }

    return template
      .replace(/{guestName}/g, fullName)
      .replace(/{firstName}/g, firstName)
      .replace(/{cabinName}/g, selectedCabinName)
      .replace(/{checkinUrl}/g, checkinUrl);
  };

  const copyToClipboard = (text, type, id, guestName) => {
    navigator.clipboard.writeText(text).then(
      () => {
        if (type === "message") {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
          showToast(`Message copied for ${guestName}!`);
        } else {
          setCopiedLinkId(id);
          setTimeout(() => setCopiedLinkId(null), 2000);
          showToast(`Waiver link copied!`);
        }
      },
      (err) => {
        console.error("Could not copy text: ", err);
      }
    );
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const insertPlaceholder = (placeholder) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setTemplate(before + placeholder + after);
    
    // Reset cursor focus
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
    }, 0);
  };

  // Date constants for active filters
  const todayStr = getLocalDateString();
  const tomorrowStr = getLocalDateString(1);

  // Filter & Sort logic
  const activeBookings = bookings
    .filter(b => {
      // 1. Only display bookings where check_out_date is today or in the future
      if (!b.check_out_date) return false;
      return b.check_out_date >= todayStr;
    })
    .filter(b => {
      // 2. Search query filter
      const guestName = b.guest_name || "";
      const guestEmail = b.guest_email || "";
      const bookingId = b.id || "";
      const matchesSearch = 
        guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guestEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bookingId.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 3. Exclude direct/Mews bookings (keep OTAs like Airbnb and Booking.com)
      const normChannel = (b.normalized_channel || b.channel || "").toLowerCase();
      const isDirect = normChannel.includes("mews") || normChannel.includes("direct") || normChannel.includes("distributor");
      if (isDirect) return false;
      
      return matchesSearch;
    })
    .sort((a, b) => {
      // 4. Sort by check-in date ASC (soonest stay at the top)
      const dateA = a.check_in_date || "";
      const dateB = b.check_in_date || "";
      return dateA.localeCompare(dateB);
    });

  const getStatusBadge = (checkIn, checkOut) => {
    if (checkIn === todayStr) {
      return <span style={styles.badgeArriving}>Arriving Today</span>;
    }
    if (checkIn === tomorrowStr) {
      return <span style={styles.badgeTomorrow}>Arriving Tomorrow</span>;
    }
    if (checkIn < todayStr && checkOut >= todayStr) {
      return <span style={styles.badgeInHouse}>In-house</span>;
    }
    return <span style={styles.badgeUpcoming}>Upcoming</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <div style={styles.container}>
      {/* Toast Alert */}
      {toastMessage && (
        <div style={styles.toast}>
          <span>⛺ {toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <header style={styles.header}>
        <div style={styles.headerInfo}>
          <div style={styles.titleRow}>
            <a href="/" style={styles.backButton}>← Dashboard</a>
            <h1 style={styles.pageTitle}>🔑 Airbnb Waiver Helper</h1>
          </div>
          <p style={styles.pageSubtitle}>
            Easily map active reservations to their specific cabin check-in links and copy invitation messages for Airbnb.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <a 
            href="https://www.airbnb.com/hosting?tab=upcoming" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={styles.airbnbHostingBtn}
            className="airbnb-hover"
          >
            🏠 Go to Airbnb Hosting
          </a>
          <button onClick={fetchBookings} style={styles.refreshBtn} disabled={loading}>
            {loading ? "Refreshing..." : "🔄 Refresh List"}
          </button>
        </div>
      </header>

      {/* Message Template Builder */}
      <section style={styles.templateSection}>
        <div style={styles.templateHeader}>
          <h2 style={styles.sectionTitle}>💬 Edit Airbnb Message Template</h2>
          <div style={styles.placeholderRow}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600" }}>Insert Field:</span>
            <button onClick={() => insertPlaceholder("{firstName}")} style={styles.placeholderTag}>First Name</button>
            <button onClick={() => insertPlaceholder("{guestName}")} style={styles.placeholderTag}>Full Name</button>
            <button onClick={() => insertPlaceholder("{cabinName}")} style={styles.placeholderTag}>Cabin Name</button>
            <button onClick={() => insertPlaceholder("{checkinUrl}")} style={styles.placeholderTag}>Check-in URL</button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          style={styles.templateInput}
          rows={3}
          placeholder="Hi {firstName}! Sign waiver at {checkinUrl}..."
        />
        <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
          💡 Placeholders like <code>{"{firstName}"}</code> and <code>{"{checkinUrl}"}</code> will automatically resolve for each guest dynamically below.
        </div>
      </section>

      {/* Main Panel */}
      <main style={styles.panel}>
        {/* Controls Header */}
        <div style={styles.panelControls}>
          <input 
            type="text" 
            placeholder="Search guest name, email, or reservation..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...styles.searchInput, width: "100%", maxWidth: "400px" }}
          />
        </div>

        {/* Bookings Table */}
        {loading ? (
          <div style={styles.loadingState}>Loading active bookings ledger...</div>
        ) : error ? (
          <div style={styles.errorState}>{error}</div>
        ) : activeBookings.length === 0 ? (
          <div style={styles.emptyState}>No matching guest bookings found with current filters.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Guest Info</th>
                  <th style={styles.th}>Stay Dates</th>
                  <th style={styles.th}>Cabin Assignment</th>
                  <th style={styles.th}>Check-in URL</th>
                  <th style={styles.th} style={{ textAlign: "right", paddingRight: "16px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeBookings.map((b) => {
                  const { fullName, selectedCabinName, checkinUrl } = getGuestDetails(b);
                  const formattedMsg = getFormattedMessage(b);
                  const isCabinSelected = !!selectedCabinName;
                  
                  const originalCabinName = b.cabin_name ? findMatchingCabin(b.cabin_name) : "";
                  const isOverridden = !!originalCabinName && !!selectedCabinName && (selectedCabinName !== originalCabinName);
                  const isMatchedFromMews = !!originalCabinName && (selectedCabinName === originalCabinName);
                  
                  return (
                    <tr key={b.id} style={styles.tr} className="tr-hover">
                      {/* Status */}
                      <td style={styles.td}>
                        {getStatusBadge(b.check_in_date, b.check_out_date)}
                      </td>
                      
                      {/* Guest Info */}
                      <td style={styles.td}>
                        <div style={styles.guestName}>{fullName}</div>
                        <div style={styles.guestEmail}>{b.guest_email || "(No email)"}</div>
                        <div style={styles.guestMeta}>
                          <span style={styles.channelLabel}>{b.channel || "Mews"}</span>
                          <span style={{ color: "#c0c6c2" }}>•</span>
                          <span style={styles.resId}>{b.id}</span>
                        </div>
                      </td>
                      
                      {/* Stay Dates */}
                      <td style={styles.td}>
                        <div style={styles.dates}>
                          {formatDate(b.check_in_date)} – {formatDate(b.check_out_date)}
                        </div>
                        <div style={styles.nightsLabel}>{b.nights} nights</div>
                      </td>
                      
                      {/* Cabin Assignment */}
                      <td style={styles.td}>
                        <select
                          value={selectedCabinName}
                          onChange={(e) => handleCabinChange(b.id, e.target.value)}
                          style={
                            isOverridden
                              ? { ...styles.cabinSelectActive, border: "1px solid #d97706", backgroundColor: "#fffbeb", color: "#b27b1e" }
                              : isMatchedFromMews
                              ? { ...styles.cabinSelectActive, border: "1px solid #2d4a3e", backgroundColor: "#f0f7f4", color: "#2d4a3e" }
                              : isCabinSelected
                              ? styles.cabinSelectActive
                              : styles.cabinSelectEmpty
                          }
                        >
                          <option value="">-- Select Cabin --</option>
                          <optgroup label="Field Cabins (1-12)">
                            {CABINS.slice(0, 12).map((c) => (
                              <option key={c.id} value={c.cabinName}>{c.cabinName} ({c.doorCode})</option>
                            ))}
                          </optgroup>
                          <optgroup label="Forest Cabins (13-24)">
                            {CABINS.slice(12).map((c) => (
                              <option key={c.id} value={c.cabinName}>{c.cabinName} ({c.doorCode})</option>
                            ))}
                          </optgroup>
                        </select>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                          {isOverridden && (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "10px", color: "#b27b1e", fontWeight: "600" }}>⚠️ Manually Changed</span>
                              <button 
                                onClick={() => handleCabinChange(b.id, originalCabinName)}
                                style={{ 
                                  background: "none", 
                                  border: "none", 
                                  padding: 0, 
                                  color: "#2d4a3e", 
                                  fontSize: "10px", 
                                  textDecoration: "underline", 
                                  cursor: "pointer",
                                  fontWeight: "600" 
                                }}
                                title={`Revert back to Mews: ${originalCabinName}`}
                              >
                                Revert
                              </button>
                            </div>
                          )}
                          {isMatchedFromMews && (
                            <span style={{ fontSize: "10px", color: "#2d4a3e", fontWeight: "600" }}>✓ Mews Assigned</span>
                          )}
                          {!originalCabinName && selectedCabinName && (
                            <span style={{ fontSize: "10px", color: "#606862", fontWeight: "600" }}>✎ Manual Selection</span>
                          )}
                          {!originalCabinName && !selectedCabinName && (
                            <span style={{ fontSize: "10px", color: "#c53030", fontWeight: "600" }}>⚠ Unassigned in Mews</span>
                          )}
                        </div>
                      </td>
                      
                      {/* URL Field */}
                      <td style={styles.td}>
                        {isCabinSelected ? (
                          <div style={styles.urlContainer}>
                            <span style={styles.urlText}>{checkinUrl}</span>
                            <button
                              onClick={() => copyToClipboard(checkinUrl, "link", b.id)}
                              style={styles.urlCopyBtn}
                              title="Copy URL"
                            >
                              {copiedLinkId === b.id ? "✔️" : "📋"}
                            </button>
                          </div>
                        ) : (
                          <span style={styles.urlWarning}>⚠️ Select cabin first</span>
                        )}
                      </td>
                      
                      {/* Actions */}
                      <td style={styles.td} style={{ textAlign: "right", paddingRight: "16px" }}>
                        <button
                          onClick={() => copyToClipboard(formattedMsg, "message", b.id, fullName)}
                          disabled={!isCabinSelected}
                          style={isCabinSelected ? styles.copyMessageBtn : styles.copyMessageBtnDisabled}
                        >
                          {copiedId === b.id ? "✓ Message Copied" : "💬 Copy Airbnb Message"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .tr-hover:hover {
          background-color: #f7faf8 !important;
        }
        .airbnb-hover:hover {
          background-color: #e04b4f !important;
          box-shadow: 0 2px 5px rgba(255, 90, 95, 0.3) !important;
        }
      `}</style>
    </div>
  );
}

// Inline styles fitting Lantern Camp Brand Guidelines (Linen background, forest green theme)
const styles = {
  container: {
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "32px 24px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: "#faf8f5",
    minHeight: "100vh",
  },
  toast: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    backgroundColor: "#2d4a3e",
    color: "#ffffff",
    padding: "12px 24px",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(45, 74, 62, 0.15)",
    zIndex: 999,
    fontSize: "14px",
    fontWeight: "600",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px",
  },
  headerInfo: {
    flex: 1,
    minWidth: "300px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "4px",
    flexWrap: "wrap",
  },
  backButton: {
    color: "#5f7a61",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: "600",
    padding: "6px 12px",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8e4",
    borderRadius: "6px",
    transition: "all 0.2s ease",
  },
  pageTitle: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#2d4a3e",
    margin: 0,
  },
  pageSubtitle: {
    color: "#606862",
    fontSize: "14px",
    marginTop: "4px",
  },
  airbnbHostingBtn: {
    backgroundColor: "#FF5A5F",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13.5px",
    fontWeight: "600",
    textDecoration: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    boxShadow: "0 1px 3px rgba(255, 90, 95, 0.2)",
    transition: "all 0.2s ease",
  },
  refreshBtn: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8e4",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13.5px",
    color: "#2d312e",
    cursor: "pointer",
    fontWeight: "500",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
    transition: "all 0.2s ease",
  },
  templateSection: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8e4",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "28px",
    boxShadow: "0 2px 8px rgba(45, 74, 62, 0.02)",
  },
  templateHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    flexWrap: "wrap",
    gap: "10px",
  },
  sectionTitle: {
    fontSize: "14px",
    color: "#2d4a3e",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  },
  placeholderRow: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  placeholderTag: {
    backgroundColor: "#f0f4f1",
    border: "1px solid #d0dad3",
    borderRadius: "4px",
    padding: "3px 8px",
    fontSize: "11px",
    cursor: "pointer",
    color: "#2d4a3e",
    fontWeight: "600",
    transition: "all 0.15s ease",
  },
  templateInput: {
    width: "100%",
    borderRadius: "8px",
    border: "1px solid #d0dad3",
    padding: "12px",
    fontFamily: "inherit",
    fontSize: "13.5px",
    color: "#2d312e",
    resize: "vertical",
    outline: "none",
    backgroundColor: "#faf8f5",
    lineHeight: "1.5",
  },
  panel: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8e4",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 4px 16px rgba(45, 74, 62, 0.03)",
  },
  panelControls: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    gap: "16px",
    flexWrap: "wrap",
  },
  searchInput: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e2e8e4",
    fontSize: "13px",
    width: "100%",
    maxWidth: "360px",
    outline: "none",
    backgroundColor: "#faf8f5",
  },
  filterGroup: {
    display: "flex",
    gap: "6px",
    backgroundColor: "#f0f4f1",
    padding: "4px",
    borderRadius: "8px",
  },
  filterTab: {
    padding: "6px 12px",
    border: "none",
    background: "none",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    color: "#606862",
    borderRadius: "6px",
    transition: "all 0.15s ease",
  },
  filterTabActive: {
    padding: "6px 12px",
    border: "none",
    backgroundColor: "#2d4a3e",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    color: "#ffffff",
    borderRadius: "6px",
    boxShadow: "0 2px 4px rgba(45, 74, 62, 0.1)",
  },
  loadingState: {
    padding: "80px 0",
    textAlign: "center",
    color: "#606862",
    fontSize: "14px",
  },
  errorState: {
    padding: "60px 0",
    textAlign: "center",
    color: "#d67a47",
    fontSize: "14px",
    fontWeight: "500",
  },
  emptyState: {
    padding: "80px 0",
    textAlign: "center",
    color: "#8a928c",
    fontSize: "13.5px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "13px",
  },
  thRow: {
    borderBottom: "2px solid #e2e8e4",
    color: "#606862",
    fontWeight: "600",
  },
  th: {
    padding: "12px 10px",
  },
  tr: {
    borderBottom: "1px solid #f0f3f1",
    transition: "background-color 0.2s ease",
  },
  td: {
    padding: "16px 10px",
    verticalAlign: "middle",
  },
  guestName: {
    fontWeight: "600",
    color: "#2d312e",
    fontSize: "13.5px",
  },
  guestEmail: {
    fontSize: "11px",
    color: "#606862",
    marginTop: "2px",
  },
  guestMeta: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    marginTop: "4px",
    fontSize: "10px",
  },
  channelLabel: {
    backgroundColor: "#fcf1eb",
    color: "#d67a47",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  resId: {
    fontFamily: "monospace",
    color: "#8a928c",
  },
  dates: {
    fontWeight: "600",
    color: "#2d312e",
  },
  nightsLabel: {
    fontSize: "11px",
    color: "#606862",
    marginTop: "2px",
  },
  cabinSelectActive: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #2d4a3e",
    fontSize: "12.5px",
    fontWeight: "600",
    backgroundColor: "#f0f4f1",
    color: "#2d4a3e",
    outline: "none",
    width: "100%",
    maxWidth: "180px",
    cursor: "pointer",
  },
  cabinSelectEmpty: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #e2e8e4",
    fontSize: "12.5px",
    backgroundColor: "#ffffff",
    color: "#606862",
    outline: "none",
    width: "100%",
    maxWidth: "180px",
    cursor: "pointer",
  },
  urlContainer: {
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "#f0f4f1",
    border: "1px solid #d0dad3",
    borderRadius: "6px",
    padding: "4px 8px",
    maxWidth: "240px",
    overflow: "hidden",
  },
  urlText: {
    fontFamily: "monospace",
    fontSize: "11px",
    color: "#2d4a3e",
    textOverflow: "ellipsis",
    overflow: "hidden",
    whiteSpace: "nowrap",
    width: "160px",
  },
  urlCopyBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0 0 0 6px",
    marginLeft: "4px",
    borderLeft: "1px solid #d0dad3",
    fontSize: "12px",
  },
  urlWarning: {
    fontSize: "11.5px",
    color: "#d67a47",
    fontWeight: "500",
  },
  copyMessageBtn: {
    backgroundColor: "#2d4a3e",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "12.5px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
  },
  copyMessageBtnDisabled: {
    backgroundColor: "#e2e8e4",
    color: "#8a928c",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "12.5px",
    fontWeight: "600",
    cursor: "not-allowed",
    whiteSpace: "nowrap",
  },
  badgeArriving: {
    backgroundColor: "#f0f4f1",
    color: "#2d4a3e",
    border: "1px solid #2d4a3e",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  badgeTomorrow: {
    backgroundColor: "#fcf1eb",
    color: "#d67a47",
    border: "1px solid #d67a47",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  badgeInHouse: {
    backgroundColor: "#e8effc",
    color: "#3b6fb6",
    border: "1px solid #3b6fb6",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  badgeUpcoming: {
    backgroundColor: "#f8f9fa",
    color: "#606862",
    border: "1px solid #e2e8e4",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  }
};
