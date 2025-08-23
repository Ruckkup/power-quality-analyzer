import React from 'react';

const TrendTabs = ({ activeTrendTab, setActiveTrendTab }) => (
  <div className="tabs-container">
    <button className={`tab-button ${activeTrendTab === 'rms' ? 'active' : ''}`} onClick={() => setActiveTrendTab('rms')}>RMS Trends</button>
    <button className={`tab-button ${activeTrendTab === 'power' ? 'active' : ''}`} onClick={() => setActiveTrendTab('power')}>Power Trends</button>
    <button className={`tab-button ${activeTrendTab === 'energy' ? 'active' : ''}`} onClick={() => setActiveTrendTab('energy')}>Energy Trends</button>
    <button className={`tab-button ${activeTrendTab === 'harmonic' ? 'active' : ''}`} onClick={() => setActiveTrendTab('harmonic')}>Harmonic Trends</button>
    <button className={`tab-button ${activeTrendTab === 'power_factor' ? 'active' : ''}`} onClick={() => setActiveTrendTab('power_factor')}>Power Factor Trends</button>
    <button className={`tab-button ${activeTrendTab === 'unbalance' ? 'active' : ''}`} onClick={() => setActiveTrendTab('unbalance')}>Unbalance Trends</button>
  </div>
);

export default TrendTabs;
