import React from 'react';
import './PageShell.css';

export function PageShell({ title, subtitle, badge, children }) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {badge && <div className="page-badge">{badge}</div>}
      </div>
      {children}
    </div>
  );
}

export function KpiGrid({ children }) {
  return <div className="kpi-grid">{children}</div>;
}

export function KpiCard({ label, value, trend, trendLabel, icon, accent }) {
  const isUp   = trend > 0;
  const isDown = trend < 0;
  return (
    <div className={`kpi-card ${accent ? 'kpi-card--accent' : ''}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {trend !== undefined && (
        <div className={`kpi-trend ${isUp ? 'up' : isDown ? 'down' : ''}`}>
          <span>{isUp ? '▲' : isDown ? '▼' : '●'}</span>
          <span>{Math.abs(trend).toFixed(1)}%</span>
          {trendLabel && <span className="trend-label">{trendLabel}</span>}
        </div>
      )}
      <div className="kpi-glow" />
    </div>
  );
}

export function Panel({ title, subtitle, actions, children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          <div className="panel-title">{title}</div>
          {subtitle && <div className="panel-subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Loader() {
  return (
    <div className="loader-wrap">
      <div className="loader-ring" />
    </div>
  );
}

export function ErrorMsg({ message }) {
  return (
    <div className="error-msg">
      <span>⚠</span> {message || 'Failed to load data'}
    </div>
  );
}

export function ImpactBadge({ value, prefix = '+' }) {
  return (
    <span className="impact-badge">
      <span>▲</span> {prefix}{typeof value === 'number' ? value.toLocaleString('en', {maximumFractionDigits:0}) : value}
    </span>
  );
}
