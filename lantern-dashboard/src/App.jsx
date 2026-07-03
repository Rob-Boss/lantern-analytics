import React, { useState, useEffect } from "react";
import OverviewTab from "./components/OverviewTab";
import AdsTab from "./components/AdsTab";
import TrafficTab from "./components/TrafficTab";
import BookingsTab from "./components/BookingsTab";
import SettingsTab from "./components/SettingsTab";

// Cache buster comment to force Vite bundle hash refresh
const API_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:8000/api`
  : (import.meta.env.VITE_API_URL || "/api");

export default function App() {
  console.log("Lantern Analytics Dashboard Initialized V1.0.1");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Set default date range: June 1, 2026 to today
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  // State caches for dashboard views
  const [overview, setOverview] = useState({ kpis: {}, trend_chart: [], last_synced: "" });
  const [ads, setAds] = useState({ channels: [], daily_breakdown: [] });
  const [traffic, setTraffic] = useState({ summary: {}, funnel: {}, daily_traffic: [] });
  const [bookings, setBookings] = useState({ bookings: [], channel_summary: [] });
  const [settings, setSettings] = useState({ newsletter_subscribers: 0, last_synced_at: "" });
  
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  // Fetch current tab data
  const fetchData = async () => {
    setLoading(true);
    setAlert(null);
    try {
      let url = "";
      if (activeTab === "overview") {
        url = `${API_BASE}/dashboard/overview?start_date=${startDate}&end_date=${endDate}`;
        const res = await fetch(url);
        const data = await res.json();
        setOverview(data);
      } else if (activeTab === "ads") {
        url = `${API_BASE}/dashboard/ads?start_date=${startDate}&end_date=${endDate}`;
        const res = await fetch(url);
        const data = await res.json();
        setAds(data);
      } else if (activeTab === "traffic") {
        url = `${API_BASE}/dashboard/traffic?start_date=${startDate}&end_date=${endDate}`;
        const res = await fetch(url);
        const data = await res.json();
        setTraffic(data);
      } else if (activeTab === "bookings") {
        url = `${API_BASE}/dashboard/bookings`;
        const res = await fetch(url);
        const data = await res.json();
        setBookings(data);
      } else if (activeTab === "settings") {
        url = `${API_BASE}/settings`;
        const res = await fetch(url);
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setAlert({ type: "error", message: "Failed to load dashboard data. Check if FastAPI backend is running." });
    } finally {
      setLoading(false);
    }
  };



  // Re-fetch when tab or date changes
  useEffect(() => {
    fetchData();
  }, [activeTab, startDate, endDate]);

  // Operations handlers
  const handleUpdateSettings = async (newsletterCount, mewsSheetId) => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          newsletter_subscribers: newsletterCount,
          mews_sheet_id: mewsSheetId 
        })
      });
      if (res.ok) {
        setAlert({ type: "success", message: "Settings updated successfully!" });
        fetchData();
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    }
  };

  const handleSyncSheets = async (spreadsheetId) => {
    const res = await fetch(`${API_BASE}/data/sync-sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spreadsheet_id: spreadsheetId })
    });
    if (!res.ok) {
      const errDetail = await res.json();
      throw new Error(errDetail.detail || "Error syncing Google Sheets");
    }
    return await res.json();
  };

  const handleTriggerSync = async () => {
    const res = await fetch(`${API_BASE}/data/sync?days=60`, { method: "POST" });
    if (!res.ok) {
      throw new Error("Failed to trigger sync task");
    }
    return await res.json();
  };

  const handleUploadCSV = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/data/upload-csv`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const errDetail = await res.json();
      throw new Error(errDetail.detail || "Error uploading file");
    }
    const data = await res.json();
    fetchData();
    return data;
  };

  const handleClearBookings = async () => {
    try {
      const res = await fetch(`${API_BASE}/data/clear-bookings`, { method: "POST" });
      if (res.ok) {
        setAlert({ type: "success", message: "All booking records cleared successfully." });
        fetchData();
      } else {
        throw new Error("Failed to clear ledger");
      }
    } catch (err) {
      setAlert({ type: "error", message: err.message });
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab kpis={overview.kpis} trendChart={overview.trend_chart} channelSummary={overview.channel_summary || []} loading={loading} />;
      case "ads":
        return <AdsTab adsData={ads} loading={loading} />;
      case "traffic":
        return <TrafficTab trafficData={traffic} loading={loading} />;
      case "bookings":
        return <BookingsTab bookingsData={bookings} loading={loading} />;
      case "settings":
        return (
          <SettingsTab 
            settings={settings} 
            onUpdateSettings={handleUpdateSettings} 
            onTriggerSync={handleTriggerSync}
            onUploadCSV={handleUploadCSV}
            onClearBookings={handleClearBookings}
            lastSynced={overview.last_synced || settings.last_synced_at}
            onSyncSheets={handleSyncSheets}
          />
        );
      default:
        return null;
    }
  };

  const showDateFilter = activeTab === "overview" || activeTab === "ads" || activeTab === "traffic";

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">⛺</div>
          <div className="logo-text">Lantern Camp</div>
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Overview
          </button>
          <button 
            className={`menu-item ${activeTab === "ads" ? "active" : ""}`}
            onClick={() => setActiveTab("ads")}
          >
            📱 Ads Performance
          </button>
          <button 
            className={`menu-item ${activeTab === "traffic" ? "active" : ""}`}
            onClick={() => setActiveTab("traffic")}
          >
            📈 Traffic & Funnel
          </button>
          <button 
            className={`menu-item ${activeTab === "bookings" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings")}
          >
            🛏 Bookings Ledger
          </button>
          <button 
            className={`menu-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ Data Operations
          </button>
        </nav>

        <div className="sidebar-footer">
          <div>Client: Addison Godine</div>
          <div style={{ marginTop: "4px" }}>Dev: Antigravity AI</div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        <header className="page-header">
          <div className="page-title">
            <h1 style={{ textTransform: "capitalize" }}>{activeTab} Workspace</h1>
            <p>Lantern Camp Analytics Integration Hub</p>
          </div>

          <div className="header-actions">
            {showDateFilter && (
              <div className="date-selector">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
                <span style={{ color: "#606862" }}>to</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
            )}
            
            <button className="btn btn-secondary" onClick={fetchData}>
              🔄 Refresh
            </button>
          </div>
        </header>

        {/* Alert banners */}
        {alert && (
          <div className={`alert-banner alert-${alert.type}`}>
            <span>{alert.message}</span>
            <button 
              onClick={() => setAlert(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: "bold" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Render Tab Contents */}
        {renderActiveTab()}
      </main>
    </div>
  );
}
