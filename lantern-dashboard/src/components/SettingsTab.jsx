import React, { useState, useEffect } from "react";

export default function SettingsTab({ 
  settings, 
  onUpdateSettings, 
  onTriggerSync, 
  onClearBookings, 
  onRefreshData, 
  isMobile 
}) {
  const [newsletterInput, setNewsletterInput] = useState(settings.newsletter_subscribers || 0);
  const [syncing, setSyncing] = useState(false);
  const [savingSubs, setSavingSubs] = useState(false);

  useEffect(() => {
    setNewsletterInput(settings.newsletter_subscribers || 0);
  }, [settings]);

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSavingSubs(true);
    try {
      await onUpdateSettings(newsletterInput);
    } finally {
      setSavingSubs(false);
    }
  };

  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      await onTriggerSync();
      alert("Ad network API sync initiated in background! Marketing metrics will be cached in Neon PostgreSQL database in a few moments.");
      if (onRefreshData) setTimeout(() => onRefreshData(), 2000);
    } catch (err) {
      alert("Error initiating sync: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "3px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "600",
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
    border: "1px solid #c8e6c9"
  };

  const statusLabelStyle = {
    fontSize: "12px",
    color: "var(--text-secondary, #606862)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 0",
    borderBottom: "1px dashed #e2e8e4"
  };

  const valueHighlightStyle = {
    fontWeight: "600",
    color: "var(--text-primary, #2d312e)"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* 1. SYSTEM DATA PIPELINES SUMMARY */}
      <div className="panel" style={{ background: "#fcfdfe", border: "1px solid #e2e8e4", borderRadius: "12px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#2d312e", margin: 0 }}>
              📡 Active Data Pipelines & Report Timestamps
            </h2>
            <p style={{ fontSize: "12px", color: "#606862", margin: "4px 0 0 0" }}>
              Source-of-truth status tracking for Mews reservations, marketing APIs, and manual reports.
            </p>
          </div>
          <button 
            onClick={() => onRefreshData && onRefreshData()} 
            className="btn btn-secondary"
            style={{ fontSize: "12px", padding: "6px 12px" }}
          >
            🔄 Refresh Status
          </button>
        </div>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", 
          gap: "16px" 
        }}>
          {/* Card 1: Mews Reservations */}
          <div style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", border: "1px solid #e8ede9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: "700", fontSize: "13.5px", color: "#1b382b" }}>🛏 Mews Reservations</span>
              <span style={badgeStyle}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#4caf50", display: "inline-block" }}></span>
                Automated Hourly
              </span>
            </div>
            
            <div style={statusLabelStyle}>
              <span>Report Pipeline:</span>
              <span style={valueHighlightStyle}>Scheduled Hourly Webhook</span>
            </div>
            <div style={statusLabelStyle}>
              <span>Last Ingested Report:</span>
              <span style={{ fontWeight: "700", color: "#2d4a3e" }}>
                {settings.last_mews_report_time || settings.last_mews_webhook_at || "Hourly Sync Active"}
              </span>
            </div>
            <div style={statusLabelStyle}>
              <span>Export Name:</span>
              <span style={{ fontSize: "11.5px", fontWeight: "600", color: "#2d312e", wordBreak: "break-all" }}>
                {settings.last_mews_report_name || "Mews Reservations Export"}
              </span>
            </div>
            <div style={statusLabelStyle}>
              <span>Latest Booking Date:</span>
              <span style={valueHighlightStyle}>{settings.latest_booking_date || "N/A"}</span>
            </div>
            <div style={{ ...statusLabelStyle, borderBottom: "none", paddingTop: "8px" }}>
              <span>Total Ledger Bookings:</span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#2d4a3e" }}>
                {settings.total_bookings_count ?? 0} Reservations
              </span>
            </div>
          </div>

          {/* Card 2: Marketing & Ad Networks */}
          <div style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", border: "1px solid #e8ede9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: "700", fontSize: "13.5px", color: "#1b382b" }}>📈 Ad Networks & Traffic</span>
              <span style={badgeStyle}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#4caf50", display: "inline-block" }}></span>
                Cron Active (:25)
              </span>
            </div>

            <div style={statusLabelStyle}>
              <span>Networks:</span>
              <span style={valueHighlightStyle}>GA4, Google Ads, Meta</span>
            </div>
            <div style={statusLabelStyle}>
              <span>Sync Pipeline:</span>
              <span style={valueHighlightStyle}>GitHub Actions Cron</span>
            </div>
            <div style={statusLabelStyle}>
              <span>Last API Sync:</span>
              <span style={{ fontWeight: "700", color: "#2d4a3e" }}>{settings.last_synced_at || "Never"}</span>
            </div>
            <div style={{ ...statusLabelStyle, borderBottom: "none", paddingTop: "8px" }}>
              <span>Reconciliation Window:</span>
              <span style={valueHighlightStyle}>Past 60 Days</span>
            </div>
          </div>

          {/* Card 3: Manual Inputs */}
          <div style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", border: "1px solid #e8ede9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontWeight: "700", fontSize: "13.5px", color: "#1b382b" }}>📰 Newsletter & Manual Data</span>
              <span style={{ ...badgeStyle, backgroundColor: "#f5f5f5", color: "#616161", border: "1px solid #e0e0e0" }}>
                Manual Input
              </span>
            </div>

            <div style={statusLabelStyle}>
              <span>Source:</span>
              <span style={valueHighlightStyle}>Squarespace Newsletter</span>
            </div>
            <div style={statusLabelStyle}>
              <span>Subscriber Count:</span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#2d4a3e" }}>
                {settings.newsletter_subscribers || 0}
              </span>
            </div>
            <div style={{ ...statusLabelStyle, borderBottom: "none", paddingTop: "8px" }}>
              <span>Last Updated:</span>
              <span style={valueHighlightStyle}>{settings.newsletter_updated_at || "Not updated"}</span>
            </div>
          </div>

        </div>
      </div>

      {/* 2. ACTIONS & SETTINGS GRID */}
      <div className="panel-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "24px" }}>
        
        {/* Left Panel: Ad Networks Sync */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Ad Networks Sync & System Reconciliation</div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#2d312e" }}>
                Sync Ad Networks & Traffic APIs
              </div>
              <div style={{ fontSize: "11.5px", color: "#606862", margin: "4px 0 14px 0", lineHeight: "1.4" }}>
                Queries GA4, Google Ads, and Meta Ads for the last 60 days and updates daily metrics in Neon PostgreSQL database.
                <br/>
                Last Synced: <strong style={{ color: "#2d4a3e" }}>{settings.last_synced_at || "Never"}</strong>
              </div>
              <button 
                onClick={handleSyncClick} 
                className="btn btn-secondary" 
                disabled={syncing}
                style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
              >
                {syncing ? (
                  <>
                    <span className="spinner" style={{ border: "2px solid #ccc", borderTop: "2px solid #2d4a3e", borderRadius: "50%", width: "14px", height: "14px", animation: "spin 1s linear infinite" }}></span>
                    Syncing Ad Networks & Analytics...
                  </>
                ) : "Sync Marketing APIs Now"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Newsletter & Danger Zone */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Newsletter Form */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Squarespace Newsletter Subscribers</div>
            </div>
            
            <form onSubmit={handleSettingsSubmit} className="settings-form">
              <div className="form-group">
                <label htmlFor="newsletter-subs">Total Subscribers Count</label>
                <input 
                  type="number" 
                  id="newsletter-subs"
                  value={newsletterInput} 
                  onChange={(e) => setNewsletterInput(parseInt(e.target.value) || 0)} 
                />
              </div>
              
              <button type="submit" className="btn btn-primary" disabled={savingSubs}>
                {savingSubs ? "Saving..." : "Save Subscriber Count"}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="panel" style={{ border: "1px solid #ffebee" }}>
            <div className="panel-header" style={{ borderBottomColor: "#ffebee" }}>
              <div className="panel-title" style={{ color: "#c62828" }}>Danger Zone</div>
            </div>
            
            <div style={{ fontSize: "11.5px", color: "#606862", marginBottom: "12px" }}>
              Deletes all reservation records stored in the database ledger.
            </div>
            
            <button 
              onClick={() => {
                if (window.confirm("Are you absolutely sure you want to delete all bookings in the ledger? This cannot be undone.")) {
                  onClearBookings();
                }
              }} 
              className="btn btn-secondary" 
              style={{ width: "100%", color: "#c62828", borderColor: "#ffcdd2" }}
            >
              Clear Bookings Ledger
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
