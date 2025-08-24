export const trendChartConfigs = [
    { title: "Line-to-Line Voltage Trend", yAxisLabel: "Voltage (V)", dataKey: "voltage_ll", type: 'rms' },
    { title: "Phase (Line-to-Neutral) Voltage Trend", yAxisLabel: "Voltage (V)", dataKey: "voltage_ln", type: 'rms' },
    { title: "Current Trend", yAxisLabel: "Current (A)", dataKey: "current", type: 'rms' },
    { title: "THDv Trend", yAxisLabel: "THDv (%)", dataKey: "thdv_percent", type: 'harmonic' },
    { title: "THDi Trend", yAxisLabel: "THDi (%)", dataKey: "thdi_percent", type: 'harmonic' },
    { title: "Active Power Trend", yAxisLabel: "Power (W)", dataKey: "active_power", type: 'power' },
    { title: "Reactive Power Trend", yAxisLabel: "Power (var)", dataKey: "reactive_power", type: 'power' },
    { title: "Apparent Power Trend", yAxisLabel: "Power (VA)", dataKey: "apparent_power", type: 'power' },
    { title: "Active Energy Trend", yAxisLabel: "Energy (Wh)", dataKey: "active_energy", type: 'energy' },
    { title: "Reactive Energy Trend", yAxisLabel: "Energy (varh)", dataKey: "reactive_energy", type: 'energy' },
    { title: "Apparent Energy Trend", yAxisLabel: "Energy (VAh)", dataKey: "apparent_energy", type: 'energy' },
    { title: "Power Factor Trend", yAxisLabel: "Power Factor", dataKey: "power_factor", type: 'power_factor' },
    { title: "Unbalance Trend", yAxisLabel: "Unbalance (%)", dataKey: "unbalance", type: 'unbalance' },
];

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const CURRENT_LIMITS_120V_to_69kV = {
    'r_le_20':       { h_lt_11: 4.0, h_11_17: 2.0, h_17_23: 1.5, h_23_35: 0.6, h_gt_35: 0.3, tdd: 5.0 },
    'r_20_to_50':    { h_lt_11: 7.0, h_11_17: 3.5, h_17_23: 2.5, h_23_35: 1.0, h_gt_35: 0.5, tdd: 8.0 },
    'r_50_to_100':   { h_lt_11: 10.0,h_11_17: 4.5, h_17_23: 4.0, h_23_35: 1.5, h_gt_35: 0.7, tdd: 12.0 },
    'r_100_to_1000': { h_lt_11: 12.0,h_11_17: 5.5, h_17_23: 5.0, h_23_35: 2.0, h_gt_35: 1.0, tdd: 15.0 },
    'r_gt_1000':     { h_lt_11: 15.0,h_11_17: 7.0, h_17_23: 6.0, h_23_35: 2.5, h_gt_35: 1.4, tdd: 20.0 },
};