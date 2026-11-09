import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { tabs } from "../lib/config.js";
import { Button, IconButton } from "./ui.jsx";

export default function Sidebar({ activeTab, onChange }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <a
        className="brand"
        href="#main-content"
        aria-label="Ledger, skip to content"
      >
        <span className="brand-mark">
          <BookOpen size={21} strokeWidth={1.7} />
        </span>
        <span className="brand-name">
          Ledger<span className="brand-subtitle">A little more clarity.</span>
        </span>
      </a>
      <div className="sidebar-section-label">Your workspace</div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              data-nav={tab.id}
              title={tab.label}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onChange(tab.id)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span className="nav-label">
                <span className="desktop-nav-label">{tab.label}</span>
                <span className="mobile-nav-label" aria-hidden="true">
                  {tab.id === "transactions"
                    ? "Activity"
                    : tab.id === "receivables"
                      ? "Owed"
                      : tab.label}
                </span>
              </span>
              {activeTab === tab.id && <span className="nav-active-dot" />}
            </Button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="sidebar-note-icon">
            <ArrowUpRight size={16} />
          </span>
          <div>
            <strong>Small steps. Clearer days.</strong>
            <p>Your money, in perspective.</p>
          </div>
        </div>
        <IconButton
          className="sidebar-collapse"
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </IconButton>
      </div>
    </aside>
  );
}
