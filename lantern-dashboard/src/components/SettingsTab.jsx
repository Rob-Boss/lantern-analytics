import React, { useState, useEffect } from "react";

export default function SettingsTab({ 
  settings, 
  onUpdateSettings, 
  onTriggerSync, 
  onUploadCSV, 
  onClearBookings, 
  onRefreshData, 
  isMobile 
}) {
  const [newsletterInput, setNewsletterInput] = useState(settings.newsletter_subscribers || 0);
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
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

  const handleFileChange = (e) => {
    setCsvFile(e.target.files[0]);
    setUploadResult(null);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!csvFile) return;

    setUploading(true);
    setUploadResult(null);
    try {
      const result = await onUploadCSV(csvFile);
      setUploadResult({
        success: true,
        rows: result.imported_rows,
        errors: result.errors || []
      });
      setCsvFile(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.message || "Failed to parse CSV file."
      });
    } finally {
      setUploading(false);
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
              Source-of-truth status and latest ingestion timestamps for Mews bookings, marketing APIs, and manual reports.
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
                {settings.last_mews_report_source || "Hourly Webhook"}
              </span>
            </div>
            
            <div style={statusLabelStyle}>
              <span>Report Type:</span>
              <span style={valueHighlightStyle}>{settings.last_mews_report_source || "Scheduled Hourly Export"}</span>
            </div>
            <div style={statusLabelStyle}>
              <span>Last Ingested Report:</span>
              <span style={{ fontWeight: "700", color: "#2d4a3e" }}>
                {settings.last_mews_report_time || settings.last_mews_webhook_at || "Hourly Sync Active"}
              </span>
            </div>
            <div style={statusLabelStyle}>
              <span>Export Name / File:</span>
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

      {/* 2. GRID OF OPERATIONS & UPLOADS */}
      <div className="panel-grid" style={{ gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr", gap: "24px" }}>
        
        {/* Left Column: Mews CSV Upload */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Import Mews Reservations CSV (Manual Override)</div>
          </div>
          
          <form onSubmit={handleUploadSubmit}>
            <label className="upload-zone" htmlFor="csv-input" style={{ cursor: "pointer" }}>
              <input 
                id="csv-input"
                type="file" 
                accept=".csv" 
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div className="upload-icon">📥</div>
              <div className="upload-text" style={{ fontWeight: "600" }}>
                {csvFile ? csvFile.name : "Select or drag Mews Reservations CSV"}
              </div>
              <div className="upload-subtext">
                Parses headers dynamically: ID/Number, Booking Date, Nights, Gross Revenue, Fee, Email, Cabin Name
              </div>
            </label>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={!csvFile || uploading}
              style={{ width: "100%", marginTop: "12px" }}
            >
              {uploading ? "Parsing and importing CSV..." : "Upload and Import CSV"}
            </button>
          </form>

          {/* Upload results feedback */}
          {uploadResult && (
            <div style={{ marginTop: "20px" }}>
              {uploadResult.success ? (
                <div className="alert-banner alert-success" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                  <div style={{ fontWeight: 600 }}>Success! Imported {uploadResult.rows} bookings into database.</div>
                  {uploadResult.errors.length > 0 && (
                    <div style={{ fontSize: "11.5px", marginTop: "8px", width: "100%" }}>
                      <div style={{ fontWeight: 600 }}>Ignored Row Warnings ({uploadResult.errors.length}):</div>
                      <ul style={{ paddingLeft: "16px", maxHeight: "100px", overflowY: "auto", margin: "4px 0" }}>
                        {uploadResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="alert-banner alert-error">
                  <span>Error: {uploadResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Actions & Manual Forms */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Ad Networks Sync Action */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Ad Networks Sync & System Reconciliation</div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#2d312e" }}>
                  Sync Ad Networks & Traffic APIs
                </div>
                <div style={{ fontSize: "11.5px", color: "#606862", margin: "4px 0 10px 0", lineHeight: "1.4" }}>
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

          {/* Newsletter Subscribers Form */}
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
              Deletes all reservation records stored in the database ledger. Use if re-uploading a clean Mews export CSV.
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
