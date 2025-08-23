""" 
This module provides the core functionality for analyzing power quality data based on the IEEE 519-2022 standard.
It includes functions to:
- Define and access harmonic limits for voltage and current.
- Perform compliance checks on voltage and current distortion.
- Calculate summary statistics from power quality measurement data.
- Generate recommendations for improving power quality.
- Prepare data for frontend visualization.
"""

import numpy as np
import pandas as pd

# =============================================================================
# 1. IEEE 519 STANDARD HARMONIC LIMITS
# =============================================================================

VOLTAGE_LIMITS = {
    "V_le_1kV":        {"individual": 5.0, "thd": 8.0},
    "V_1kV_to_69kV":   {"individual": 3.0, "thd": 5.0},
    "V_69kV_to_161kV": {"individual": 1.5, "thd": 2.5},
    "V_gt_161kV":      {"individual": 1.0, "thd": 1.5},
}

CURRENT_LIMITS_120V_to_69kV = {
    (0, 20):       {"h_lt_11": 4.0, "h_11_17": 2.0, "h_17_23": 1.5, "h_23_35": 0.6, "h_gt_35": 0.3, "tdd": 5.0},
    (20, 50):      {"h_lt_11": 7.0, "h_11_17": 3.5, "h_17_23": 2.5, "h_23_35": 1.0, "h_gt_35": 0.5, "tdd": 8.0},
    (50, 100):     {"h_lt_11": 10.0,"h_11_17": 4.5, "h_17_23": 4.0, "h_23_35": 1.5, "h_gt_35": 0.7, "tdd": 12.0},
    (100, 1000):   {"h_lt_11": 12.0,"h_11_17": 5.5, "h_17_23": 5.0, "h_23_35": 2.0, "h_gt_35": 1.0, "tdd": 15.0},
    (1000, float('inf')): {"h_lt_11": 15.0,"h_11_17": 7.0, "h_17_23": 6.0, "h_23_35": 2.5, "h_gt_35": 1.4, "tdd": 20.0},
}

# =============================================================================
# 2. HELPER FUNCTIONS
# =============================================================================
def nan_to_zero(value):
    """
    Converts NaN values to 0.0, suitable for JSON serialization.

    Args:
        value: The value to convert.

    Returns:
        The converted value.
    """
    if pd.isna(value) or np.isnan(value):
        return 0.0
    return float(value)

def to_numeric_safe(series):
    """
    Converts a pandas Series to numeric type, coercing errors to NaN and filling with 0.

    Args:
        series: The pandas Series to convert.

    Returns:
        The converted pandas Series.
    """
    return pd.to_numeric(series, errors='coerce').fillna(0)

def get_percentile_safe(series, percentile=95):
    """
    Calculates the specified percentile of a pandas Series, returning 0.0 for empty or all-NaN series.

    Args:
        series: The pandas Series to calculate the percentile from.
        percentile: The percentile to calculate (default is 95).

    Returns:
        The calculated percentile.
    """
    if series.empty or series.isnull().all():
        return 0.0
    return series.quantile(percentile / 100.0)

def calculate_thd_percentiles(df, thd_type, percentile_95=True, percentile_99=True):
    """
    Calculates the 95th and 99th percentiles for THD (Total Harmonic Distortion) values.

    Args:
        df: The DataFrame containing the THD data.
        thd_type: The type of THD to calculate ('U' for voltage, 'A' for current).
        percentile_95: Whether to calculate the 95th percentile (default is True).
        percentile_99: Whether to calculate the 99th percentile (default is True).

    Returns:
        A dictionary containing the calculated percentiles.
    """
    results = {}
    phases = [1, 2, 3]
    thd_cols = [f'{thd_type}{p} THD' for p in phases]

    for col in thd_cols:
        if col in df.columns:
            series = to_numeric_safe(df[col])
            if not series.empty:
                if percentile_99:
                    results[f'{col}_99th_3s'] = get_percentile_safe(series, 99)
                
                resampled_10min = series.resample('10min').apply(lambda x: get_percentile_safe(x, 95) if not x.empty else np.nan).dropna()

                if not resampled_10min.empty:
                    if percentile_95:
                        results[f'{col}_95th_10min'] = get_percentile_safe(resampled_10min, 95)
                    if percentile_99:
                        results[f'{col}_99th_10min'] = get_percentile_safe(resampled_10min, 99)
    return results

def calculate_individual_harmonic_percentiles(df, prefix, percentile=95):
    """
    Calculates the specified percentile for individual harmonic orders.

    Args:
        df: The DataFrame containing the harmonic data.
        prefix: The prefix for the harmonic columns ('V' for voltage, 'A' for current).
        percentile: The percentile to calculate (default is 95).

    Returns:
        A dictionary containing the calculated percentiles.
    """
    results = {}
    harmonic_orders = list(range(2, 51))
    phases = [1, 2, 3]

    for h in harmonic_orders:
        for p in phases:
            col = f'{prefix}{p}h{h}'
            if col in df.columns:
                series = to_numeric_safe(df[col])
                if not series.empty:
                    results[f'{col}_{percentile}th'] = get_percentile_safe(series, percentile)
    return results

def get_current_limit_for_harmonic(order, limit_row):
    """
    Retrieves the current limit for a specific harmonic order from the limit row.

    Args:
        order: The harmonic order.
        limit_row: The dictionary containing the current limits.

    Returns:
        The current limit for the specified harmonic order.
    """
    if not limit_row: return float('inf')
    if order < 11: return limit_row.get('h_lt_11', float('inf'))
    if 11 <= order < 17: return limit_row.get('h_11_17', float('inf'))
    if 17 <= order < 23: return limit_row.get('h_17_23', float('inf'))
    if 23 <= order < 35: return limit_row.get('h_23_35', float('inf'))
    if order >= 35: return limit_row.get('h_gt_35', float('inf'))
    return float('inf')

def generate_recommendations(analysis_summary):
    """
    Generates recommendations based on the analysis summary.

    Args:
        analysis_summary: A dictionary containing the analysis results.

    Returns:
        A list of recommendations.
    """
    recommendations = []
    if analysis_summary["voltage_compliance"] == "Fail":
        recommendations.append("Investigate voltage sources for harmonic distortion. Consider passive or active harmonic filters.")
    if analysis_summary["current_compliance"] == "Fail":
        recommendations.append("Identify non-linear loads causing current distortion. Consider installing harmonic filters.")
    if analysis_summary.get("summary_stats", {}).get("power_factor_avg", 1.0) < 0.95:
        recommendations.append("Improve power factor by installing capacitor banks or using active power factor correction (PFC).")
    
    if not recommendations:
        recommendations.append("System power quality appears to be in good condition. Continuous monitoring is recommended.")
    
    return recommendations

def thai_to_gregorian_year(date_str):
    """
    Converts a date string with a Thai year to a Gregorian year.

    Args:
        date_str: The date string to convert.

    Returns:
        The converted date string.
    """
    if pd.isna(date_str):
        return date_str
    try:
        parts = str(date_str).split('/')
        day, month, thai_year = int(parts[0]), int(parts[1]), int(parts[2])
        gregorian_year = thai_year - 543
        return f"{day:02d}/{month:02d}/{gregorian_year}"
    except (ValueError, IndexError):
        return date_str

def get_last_value_safe(series):
    """
    Safely gets the last value of a series, returning 0.0 if the series is empty.
    """
    if series.empty:
        return 0.0
    return series.iloc[-1]

# =============================================================================
# 3. MAIN ANALYSIS FUNCTION
# =============================================================================

def analyze_full_data(dfs, nominal_voltage, isc, il):
    """
    Performs a full analysis of the power quality data.

    Args:
        dfs: A dictionary of DataFrames, with keys corresponding to the worksheet names.
        nominal_voltage: The nominal voltage of the system.
        isc: The short-circuit current at the point of common coupling (PCC).
        il: The maximum demand load current at the PCC.

    Returns:
        A dictionary containing the analysis results.
    """
    df_trend = dfs.get('Trend')
    df_vh_harmonics = dfs.get('Vh Harmonic %')
    df_ah_harmonics = dfs.get('Ah Harmonic %')

    if df_trend is None or df_vh_harmonics is None or df_ah_harmonics is None:
        raise ValueError("Missing required worksheets.")

    clean_df = df_trend.copy()
    date_str = pd.Series(clean_df.get('Date', pd.Series([]))).astype(str).apply(thai_to_gregorian_year)
    time_str = pd.Series(clean_df.get('Time', pd.Series([]))).astype(str)
    clean_df['Timestamp'] = pd.to_datetime(date_str + ' ' + time_str, format='%d/%m/%Y %H:%M:%S', errors='coerce')
    clean_df.dropna(subset=['Timestamp'], inplace=True)
    clean_df.set_index('Timestamp', inplace=True)
    clean_df = clean_df[~clean_df.index.duplicated(keep='first')]

    voltage_thd_percentiles = calculate_thd_percentiles(clean_df, 'U')
    current_thd_percentiles = calculate_thd_percentiles(clean_df, 'A')

    thdv_overall = voltage_thd_percentiles.get('U1 THD_95th_10min', 0)
    thdi_overall = current_thd_percentiles.get('A1 THD_95th_10min', 0)

    summary_stats = {
        'u1_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('U1 RMS', pd.Series([]))).mean()),
        'u2_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('U2 RMS', pd.Series([]))).mean()),
        'u3_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('U3 RMS', pd.Series([]))).mean()),
        'v1_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('V1 RMS', pd.Series([]))).mean()),
        'v2_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('V2 RMS', pd.Series([]))).mean()),
        'v3_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('V3 RMS', pd.Series([]))).mean()),
        'a1_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('A1 RMS', pd.Series([]))).mean()),
        'a2_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('A2 RMS', pd.Series([]))).mean()),
        'a3_rms_avg': nan_to_zero(to_numeric_safe(clean_df.get('A3 RMS', pd.Series([]))).mean()),
        'a1_rms_max': nan_to_zero(to_numeric_safe(clean_df.get('A1 RMS', pd.Series([]))).max()),
        'a2_rms_max': nan_to_zero(to_numeric_safe(clean_df.get('A2 RMS', pd.Series([]))).max()),
        'a3_rms_max': nan_to_zero(to_numeric_safe(clean_df.get('A3 RMS', pd.Series([]))).max()),
        'active_power_avg': nan_to_zero(to_numeric_safe(clean_df.get('W Total', pd.Series([]))).mean()),
        'reactive_power_avg': nan_to_zero(to_numeric_safe(clean_df.get('var Total', pd.Series([]))).mean()),
        'apparent_power_avg': nan_to_zero(to_numeric_safe(clean_df.get('VA Total', pd.Series([]))).mean()),
        'active_energy_total': nan_to_zero(get_last_value_safe(to_numeric_safe(clean_df.get('Wh Total', pd.Series([]))))),
        'reactive_energy_total': nan_to_zero(get_last_value_safe(to_numeric_safe(clean_df.get('varh Total', pd.Series([]))))),
        'apparent_energy_total': nan_to_zero(get_last_value_safe(to_numeric_safe(clean_df.get('VAh Total', pd.Series([]))))),
        'thdv_percent_avg': nan_to_zero(thdv_overall),
        'thdi_percent_avg': nan_to_zero(thdi_overall),
    }

    active_power = to_numeric_safe(clean_df.get('W Total', pd.Series([0])))
    apparent_power = to_numeric_safe(clean_df.get('VA Total', pd.Series([0])))
    power_factors = active_power / apparent_power.where(apparent_power != 0, np.nan)
    summary_stats['power_factor_avg'] = nan_to_zero(power_factors.mean())

    tdd = 0.0
    thdi_for_tdd = current_thd_percentiles.get('A1 THD_95th_10min', 0)
    current_rms_avg = summary_stats['a1_rms_avg']
    if thdi_for_tdd > 0 and current_rms_avg > 0 and il > 0:
        thdi_per_unit = thdi_for_tdd / 100.0
        Ih_rms = (current_rms_avg / np.sqrt(1 + thdi_per_unit**2)) * thdi_per_unit
        tdd = (Ih_rms / il) * 100.0 if il > 0 else 0.0

    failing_points = {}
    voltage_compliance = "Pass"
    v_limit_table = VOLTAGE_LIMITS.get("V_gt_161kV")
    if nominal_voltage <= 1000: v_limit_table = VOLTAGE_LIMITS.get("V_le_1kV")
    elif nominal_voltage <= 69000: v_limit_table = VOLTAGE_LIMITS.get("V_1kV_to_69kV")
    elif nominal_voltage <= 161000: v_limit_table = VOLTAGE_LIMITS.get("V_69kV_to_161kV")

    def add_failing_point(category, description, phase=None, harmonic=None):
        if category not in failing_points:
            failing_points[category] = {}
        if description not in failing_points[category]:
            failing_points[category][description] = {"phases": [], "harmonics": []}
        
        if phase and phase not in failing_points[category][description]["phases"]:
            failing_points[category][description]["phases"].append(phase)
        if harmonic and harmonic not in failing_points[category][description]["harmonics"]:
            failing_points[category][description]["harmonics"].append(harmonic)

    if v_limit_table:
        for phase in [1, 2, 3]:
            thdv_99th_3s = voltage_thd_percentiles.get(f'U{phase} THD_99th_3s', 0)
            thdv_95th_10min = voltage_thd_percentiles.get(f'U{phase} THD_95th_10min', 0)

            if thdv_99th_3s > (v_limit_table["thd"] * 1.5):
                voltage_compliance = "Fail"
                add_failing_point("Voltage THD", "99th Percentile (3s) > 1.5x limit", phase=f"U{phase}")
            
            if thdv_95th_10min > v_limit_table["thd"]:
                voltage_compliance = "Fail"
                add_failing_point("Voltage THD", "95th Percentile (10min) > limit", phase=f"U{phase}")

        vh_individual_percentiles = calculate_individual_harmonic_percentiles(df_vh_harmonics, 'V', 95)
        for h in range(2, 51):
            failed_phases = []
            for phase in [1, 2, 3]:
                vh_95th = vh_individual_percentiles.get(f'V{phase}h{h}_95th', 0)
                if vh_95th > v_limit_table["individual"]:
                    voltage_compliance = "Fail"
                    failed_phases.append(f"V{phase}")
            if failed_phases:
                add_failing_point("Individual Voltage Harmonics", f"Harmonic {h} > limit", phase=", ".join(failed_phases))


    current_compliance = "Pass"
    isc_il_ratio = isc / il if il > 0 else 0
    c_limit_row = None
    if nominal_voltage <= 69000:
        for (min_r, max_r), limits in CURRENT_LIMITS_120V_to_69kV.items():
            if min_r <= isc_il_ratio < max_r:
                c_limit_row = limits
                break
    
    if c_limit_row:
        if tdd > c_limit_row["tdd"]:
            current_compliance = "Fail"
            add_failing_point("Current TDD", "Overall TDD > limit")

        for phase in [1, 2, 3]:
            thdi_99th_3s = current_thd_percentiles.get(f'A{phase} THD_99th_3s', 0)
            thdi_95th_10min = current_thd_percentiles.get(f'A{phase} THD_95th_10min', 0)
            thdi_99th_10min = current_thd_percentiles.get(f'A{phase} THD_99th_10min', 0)

            if thdi_99th_3s > (c_limit_row["tdd"] * 2):
                current_compliance = "Fail"
                add_failing_point("Current THD", "99th Percentile (3s) > 1.5x TDD limit", phase=f"A{phase}")
            
            if thdi_95th_10min > c_limit_row["tdd"]:
                current_compliance = "Fail"
                add_failing_point("Current THD", "95th Percentile (10min) > TDD limit", phase=f"A{phase}")

            if thdi_99th_10min > (c_limit_row["tdd"] * 1.5):
                current_compliance = "Fail"
                add_failing_point("Current THD", "99th Percentile (10min) > 1.5x TDD limit", phase=f"A{phase}")

        ah_individual_percentiles = calculate_individual_harmonic_percentiles(df_ah_harmonics, 'A', 95)
        for h in range(2, 51):
            failed_phases = []
            for phase in [1, 2, 3]:
                ah_95th = ah_individual_percentiles.get(f'A{phase}h{h}_95th', 0)
                limit = get_current_limit_for_harmonic(h, c_limit_row)
                if ah_95th > limit:
                    current_compliance = "Fail"
                    failed_phases.append(f"A{phase}")
            if failed_phases:
                add_failing_point("Individual Current Harmonics", f"Harmonic {h} > limit", phase=", ".join(failed_phases))

    harmonic_orders = list(range(2, 51))
    vh_bar_chart_data = []
    ah_bar_chart_data = []

    vh_individual_percentiles = calculate_individual_harmonic_percentiles(df_vh_harmonics, 'V', 95)
    ah_individual_percentiles = calculate_individual_harmonic_percentiles(df_ah_harmonics, 'A', 95)

    for h in harmonic_orders:
        vh_h_values = [vh_individual_percentiles.get(f'V{p}h{h}_95th', 0) for p in [1, 2, 3]]
        ah_h_values = [ah_individual_percentiles.get(f'A{p}h{h}_95th', 0) for p in [1, 2, 3]]
        
        vh_bar_chart_data.append(nan_to_zero(np.mean(vh_h_values)) if vh_h_values else 0.0)
        ah_bar_chart_data.append(nan_to_zero(np.mean(ah_h_values)) if ah_h_values else 0.0)

    timestamps_list = clean_df.index.strftime('%Y-%m-%d %H:%M:%S').tolist()
    
    # Helper for converting series to list with NaNs as 0
    def series_to_json_list(col_name):
        return to_numeric_safe(clean_df.get(col_name)).fillna(0).tolist()
    
    trend_data = {
        'timestamps': timestamps_list,
        'voltage_ll': {
            'U1 RMS': series_to_json_list('U1 RMS'),
            'U2 RMS': series_to_json_list('U2 RMS'),
            'U3 RMS': series_to_json_list('U3 RMS'),
        },
        'voltage_ln': {
            'V1 RMS': series_to_json_list('V1 RMS'),
            'V2 RMS': series_to_json_list('V2 RMS'),
            'V3 RMS': series_to_json_list('V3 RMS'),
        },
        'current': {
            'A1 RMS': series_to_json_list('A1 RMS'),
            'A2 RMS': series_to_json_list('A2 RMS'),
            'A3 RMS': series_to_json_list('A3 RMS'),
        },
        'active_power': {'W Total': series_to_json_list('W Total')},
        'reactive_power': {'var Total': series_to_json_list('var Total')},
        'apparent_power': {'VA Total': series_to_json_list('VA Total')},
        'active_energy': {'Wh Total': series_to_json_list('Wh Total')},
        'reactive_energy': {'varh Total': series_to_json_list('varh Total')},
        'apparent_energy': {'VAh Total': series_to_json_list('VAh Total')},
        'thdv_percent': {
            'U1 THD': series_to_json_list('U1 THD'),
            'U2 THD': series_to_json_list('U2 THD'),
            'U3 THD': series_to_json_list('U3 THD'),
        },
        'thdi_percent': {
            'A1 THD': series_to_json_list('A1 THD'),
            'A2 THD': series_to_json_list('A2 THD'),
            'A3 THD': series_to_json_list('A3 THD'),
        },
        'power_factor': {
            'PF1': series_to_json_list('PF1'),
            'PF2': series_to_json_list('PF2'),
            'PF3': series_to_json_list('PF3'),
            'PF Mean': series_to_json_list('PF Mean'),
        },
        'unbalance': {
            'Vunb': series_to_json_list('Vunb'),
            'Aunb': series_to_json_list('Aunb'),
        }
    }
    
    analysis_results = {
        "thdv_percent": nan_to_zero(thdv_overall),
        "tdd_percent": nan_to_zero(tdd),
        "summary_stats": summary_stats,
        "voltage_compliance": voltage_compliance,
        "current_compliance": current_compliance,
        "failing_points": failing_points,
        "bar_chart_data": {
            "labels": harmonic_orders,
            "vh_data": vh_bar_chart_data,
            "ah_data": ah_bar_chart_data
        },
        "trend_data": trend_data
    }
    
    analysis_results["recommendations"] = generate_recommendations(analysis_results)
    
    return analysis_results
