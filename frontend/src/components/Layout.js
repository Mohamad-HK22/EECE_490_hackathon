import React, { useMemo, useState } from 'react';
import { useData } from '../hooks/useData';
import { api } from '../utils/api';
import './Layout.css';

const NAV_ITEMS = [
  { id: 'executive',  label: 'Executive Summary', icon: '⊞',  section: 'Overview' },
  { id: 'changed',    label: 'What Changed',      icon: '↗',  section: 'Overview' },
  { id: 'actions',    label: 'Action Generator',  icon: '⚡', section: 'Actions'  },
  { id: 'simulator',  label: 'Profit Simulator',  icon: '◎',  section: 'Actions'  },
  { id: 'dna',        label: 'Group DNA',          icon: '⬡',  section: 'Intelligence' },
  { id: 'reports',    label: 'Reports',            icon: '📄', section: 'Intelligence' },
];

const SECTIONS = ['Overview', 'Actions', 'Intelligence'];

export default function Layout({ currentPage, onNavigate, branch, onBranchChange, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: branches } = useData(() => api.branches(), []);
  const branchOptions = useMemo(
    () => (branches || []).filter(b => b && b.branch).map(b => b.branch),
    [branches]
  );

  return (
    <div className="app-shell">
      {/* TOP NAV */}
      <nav className="topnav">
        <button className="nav-brand" onClick={() => onNavigate('executive')}>
          <div className="nav-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
              <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
            </svg>
          </div>
          <div className="nav-title">
            <span className="nav-title-main">Stories Profit Genome</span>
            <span className="nav-title-sub">AI Decision Copilot</span>
          </div>
        </button>
        <div className="nav-divider" />
        <div className="nav-center" />
        <div className="nav-controls">
          <select
            className="nav-select"
            value={branch}
            onChange={e => onBranchChange(e.target.value)}
          >
            <option value="all">All Branches</option>
            {branchOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="nav-avatar">SC</div>
        </div>
      </nav>

      <div className="body-layout">
        {/* SIDEBAR */}
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
          <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            <span className="toggle-icon">{collapsed ? '›' : '‹'}</span>
          </button>
          <nav className="sidebar-nav">
            {SECTIONS.map(section => (
              <div key={section}>
                <div className="nav-section-label">{section}</div>
                {NAV_ITEMS.filter(n => n.section === section).map(item => (
                  <button
                    key={item.id}
                    className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.label : ''}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {collapsed && <div className="nav-tooltip">{item.label}</div>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="user-avatar-sm">SC</div>
              <span className="user-name">Stories Coffee</span>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="main-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
