import React, { useState, useEffect } from "react";

export default function SettingsTab({ settings, onUpdateSettings, onTriggerSync, onUploadCSV, onClearBookings, lastSynced, onSyncSheets }) {
  const [newsletterInput, setNewsletterInput] = useState(settings.newsletter_subscribers || 0);
  const [sheetIdInput, setSheetIdInput] = useState(settings.mews_sheet_id || "");
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [sheetsSyncing, setSheetsSyncing] = useState(false);

  useEffect(() => {
    setNewsletterInput(settings.newsletter_subscribers || 0);
    setSheetIdInput(settings.mews_sheet_id || "");
  }, [settings]);

  const handleSettingsSubmit = (e) => {
    e.preventDefault();
    onUpdateSettings(newsletterInput, sheetIdInput);
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
      alert("API Data sync initiated in background! It will cache marketing metrics locally in a few moments. Refresh the page to see details.");
    } catch (err) {
      alert("Error initiating sync: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSheetsSyncClick = async () => {
    if (!sheetIdInput) {
      alert("Please save a Google Sheet ID first.");
      return;
    }
    setSheetsSyncing(true);
    try {
      const result = await onSyncSheets(sheetIdInput);
      alert(`Google Sheet Sync Complete! Imported ${result.imported_rows} bookings.`);
    } catch (err) {
      alert("Error syncing from Google Sheets: " + err.message);
    } finally {
      setSheetsSyncing(false);
    }
  };

  return (
    <div>
      <div className="panel-grid" style={{ gridTemplateColumns: "1.1fr 1fr", gap: "24px" }}>
        
        {/* CSV Upload Section */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Import Mews Reservations CSV</div>
          </div>
          
          <form onSubmit={handleUploadSubmit}>
            <label className="upload-zone" htmlFor="csv-input">
              <input 
                id="csv-input"
                type="file" 
                accept=".csv" 
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div className="upload-icon">📥</div>
              <div className="upload-text">
                {csvFile ? csvFile.name : "Select or drag Mews Reservations CSV"}
              </div>
              <div className="upload-subtext">
                Reads headers dynamically: ID/Number, Date/Created, Nights, Gross Revenue, Fee, Email
              </div>
            </label>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={!csvFile || uploading}
              style={{ width: "100%" }}
            >
              {uploading ? "Parsing and importing..." : "Upload and Parse CSV"}
            </button>
          </form>

          {/* Upload results */}
          {uploadResult && (
            <div style={{ marginTop: "20px" }}>
              {uploadResult.success ? (
                <div className="alert-banner alert-success" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                  <div style={{ fontWeight: 600 }}>Success! Imported {uploadResult.rows} bookings.</div>
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

        {/* Manual inputs & Operations */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Settings Form */}
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

              <div className="form-group">
                <label htmlFor="mews-sheet-id">Mews Google Sheet ID</label>
                <input 
                  type="text" 
                  id="mews-sheet-id"
                  value={sheetIdInput} 
                  onChange={(e) => setSheetIdInput(e.target.value)} 
                  placeholder="e.g. 1a2b3c4d5e..."
                />
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px", lineHeight: "1.3" }}>
                  Share the sheet with: <br/>
                  <code style={{ backgroundColor: "var(--sage-light)", padding: "2px 4px", borderRadius: "3px", fontSize: "10px", wordBreak: "break-all" }}>
                    ga4-reporter@lantern-ads-api-500420.iam.gserviceaccount.com
                  </code> <br/>
                  as a **Viewer**.
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary">
                Save Settings
              </button>
            </form>
          </div>

          {/* Actions panel */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">System Actions & Cron Sync</div>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "12.5px", fontWeight: "600", color: "#2d312e" }}>
                  Ad Networks & Analytics Sync
                </div>
                <div style={{ fontSize: "11.5px", color: "#606862", marginBottom: "8px" }}>
                  Queries GA4, Google Ads, and Meta Ads for the last 30 days and caches metrics in SQLite.
                  Last Synced: <strong style={{ color: "#2d4a3e" }}>{lastSynced}</strong>
                </div>
                <button 
                  onClick={handleSyncClick} 
                  className="btn btn-secondary" 
                  disabled={syncing}
                  style={{ width: "100%", marginBottom: "12px" }}
                >
                  {syncing ? "Syncing APIs..." : "Sync Marketing APIs Now"}
                </button>
              </div>

              <div style={{ borderTop: "1px solid #e2e8e4", paddingTop: "12px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: "600", color: "#2d312e" }}>
                  Google Sheets Sync Bridge
                </div>
                <div style={{ fontSize: "11.5px", color: "#606862", marginBottom: "8px" }}>
                  Pulls new bookings from the Google Sheet shared via settings.
                </div>
                <button 
                  onClick={handleSheetsSyncClick} 
                  className="btn btn-secondary" 
                  disabled={sheetsSyncing || !sheetIdInput}
                  style={{ width: "100%" }}
                >
                  {sheetsSyncing ? "Syncing Google Sheets..." : "Sync Bookings from Google Sheet"}
                </button>
              </div>

              <div style={{ borderTop: "1px solid #e2e8e4", paddingTop: "12px", marginTop: "8px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: "600", color: "#c62828" }}>
                  Danger Zone
                </div>
                <div style={{ fontSize: "11.5px", color: "#606862", marginBottom: "8px" }}>
                  Deletes all booking reservations stored in the system. Use if you want to upload a clean, fresh CSV file.
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

      </div>
    </div>
  );
}
