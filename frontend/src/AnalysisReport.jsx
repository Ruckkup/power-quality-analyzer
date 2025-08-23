import React, { useState, useRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import HarmonicBarChart from './HarmonicBarChart';
import TrendChart from './TrendChart';
import TrendTabs from './TrendTabs';
import { Tooltip } from 'react-tooltip';
import { FaQuestionCircle } from "react-icons/fa";
import jsPDF from 'jspdf';
import { getVoltageLimit, getCurrentLimitData } from './utils';

// --- Harmonic Criteria Tooltip Component ---
const HarmonicCriteriaTooltip = ({ systemInfo }) => {
    const { nominal_voltage, isc, il } = systemInfo;
    const isc_il_ratio = il > 0 ? isc / il : 0;

    const getVoltageHighlight = (voltage) => {
        const nominal_voltage_kv = nominal_voltage / 1000;
        if (voltage === '<= 1 kV' && nominal_voltage_kv <= 1) return 'highlight';
        if (voltage === '> 1 kV to 69 kV' && nominal_voltage_kv > 1 && nominal_voltage_kv <= 69) return 'highlight';
        if (voltage === '> 69 kV to 161 kV' && nominal_voltage_kv > 69 && nominal_voltage_kv <= 161) return 'highlight';
        if (voltage === '> 161 kV' && nominal_voltage_kv > 161) return 'highlight';
        return '';
    };

    const getCurrentHighlight = (ratio) => {
        if (ratio === '<20' && isc_il_ratio < 20) return 'highlight';
        if (ratio === '20-50' && isc_il_ratio >= 20 && isc_il_ratio < 50) return 'highlight';
        if (ratio === '50-100' && isc_il_ratio >= 50 && isc_il_ratio < 100) return 'highlight';
        if (ratio === '100-1000' && isc_il_ratio >= 100 && isc_il_ratio < 1000) return 'highlight';
        if (ratio === '>1000' && isc_il_ratio >= 1000) return 'highlight';
        return '';
    };

    return (
        <div className="tooltip-content">
            <h4>IEEE 519 Harmonic Voltage Limits</h4>
            <table className="criteria-table">
                <thead>
                    <tr>
                        <th>Bus Voltage at PCC</th>
                        <th>Individual Harmonic (%)</th>
                        <th>Total Harmonic Distortion (THD) (%)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className={getVoltageHighlight('<= 1 kV')}>
                        <td>&lt;= 1 kV</td>
                        <td>5.0</td>
                        <td>8.0</td>
                    </tr>
                    <tr className={getVoltageHighlight('> 1 kV to 69 kV')}>
                        <td>&gt; 1 kV to 69 kV</td>
                        <td>3.0</td>
                        <td>5.0</td>
                    </tr>
                    <tr className={getVoltageHighlight('> 69 kV to 161 kV')}>
                        <td>&gt; 69 kV to 161 kV</td>
                        <td>1.5</td>
                        <td>2.5</td>
                    </tr>
                    <tr className={getVoltageHighlight('> 161 kV')}>
                        <td>&gt; 161 kV</td>
                        <td>1.0</td>
                        <td>1.5</td>
                    </tr>
                </tbody>
            </table>
            <hr />
            <h4>IEEE 519 Harmonic Current Limits (% of I<sub>L</sub>)</h4>
            <table className="criteria-table">
                <thead>
                    <tr>
                        <th>I<sub>sc</sub>/I<sub>L</sub></th>
                        <th>&lt;11h</th>
                        <th>11-17h</th>
                        <th>17-23h</th>
                        <th>23-35h</th>
                        <th>&gt;35h</th>
                        <th>TDD</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className={getCurrentHighlight('<20')}><td>&lt;20</td><td>4.0</td><td>2.0</td><td>1.5</td><td>0.6</td><td>0.3</td><td>5.0</td></tr>
                    <tr className={getCurrentHighlight('20-50')}><td>20-50</td><td>7.0</td><td>3.5</td><td>2.5</td><td>1.0</td><td>0.5</td><td>8.0</td></tr>
                    <tr className={getCurrentHighlight('50-100')}><td>50-100</td><td>10.0</td><td>4.5</td><td>4.0</td><td>1.5</td><td>0.7</td><td>12.0</td></tr>
                    <tr className={getCurrentHighlight('100-1000')}><td>100-1000</td><td>12.0</td><td>5.5</td><td>5.0</td><td>2.0</td><td>1.0</td><td>15.0</td></tr>
                    <tr className={getCurrentHighlight('>1000')}><td>&gt;1000</td><td>15.0</td><td>7.0</td><td>6.0</td><td>2.5</td><td>1.4</td><td>20.0</td></tr>
                </tbody>
            </table>
        </div>
    );
};

// --- Formatting Helper Function ---
const formatValue = (value, unit) => {
    if (value === null || typeof value === 'undefined') return `0.00 ${unit}`;
    if (value > 999999) {
        return `${(value / 1000000).toFixed(2)} M${unit}`;
    }
    if (value > 999) {
      return `${(value / 1000).toFixed(2)} k${unit}`;
    }
    return `${value.toFixed(2)} ${unit}`;
};

const SummaryItem = ({ label, value, unit = '' }) => {
    const isCompliance = label.toLowerCase().includes('compliance');
    const valueClassName = isCompliance ? `summary-value ${value.toLowerCase()}` : 'summary-value';

    return (
        <div className="summary-item">
            <span className="summary-label">{label}</span>
            <span className={valueClassName}>{value} {unit}</span>
        </div>
    );
};

// --- Main AnalysisReport Component ---
const AnalysisReport = React.forwardRef(({ 
    analysisResult, 
    filteredTrendData, 
    activeTrendTab, 
    chartKey, 
    startDate, 
    endDate, 
    startTime, 
    endTime, 
    setStartDate, 
    setEndDate, 
    setStartTime, 
    setEndTime, 
    handleResetTime, 
    timeInterval,
    setActiveTrendTab,
    generateColorFromString,
    systemInfo
}, ref) => {

    const [isPrinting, setIsPrinting] = useState(false);
    const vhChartRef = useRef(null);
    const ahChartRef = useRef(null);
    const trendChartRefs = useMemo(() => new Map(), []);

    const handleExportPDF = () => {
        setIsPrinting(true);

        setTimeout(() => {
            const generatePdf = async () => {
                const doc = new jsPDF('p', 'mm', 'a4');
                const margin = 15;
                const docWidth = doc.internal.pageSize.getWidth();
                const docHeight = doc.internal.pageSize.getHeight();
                let y = margin;

                const checkPageBreak = (heightNeeded) => {
                    if (y + heightNeeded > docHeight - margin) {
                        doc.addPage();
                        y = margin;
                    }
                };

                const drawTitle = (title) => {
                    doc.setFontSize(18);
                    doc.setFont(undefined, 'bold');
                    doc.text(title, docWidth / 2, y, { align: 'center' });
                    y += 10;
                    doc.setFont(undefined, 'normal');
                };

                const drawSectionTitle = (title) => {
                    checkPageBreak(15);
                    doc.setFontSize(14);
                    doc.setFont(undefined, 'bold');
                    doc.text(title, margin, y);
                    y += 8;
                    
                    doc.setFont(undefined, 'normal');
                };

                const drawText = (text, options = {}) => {
                    checkPageBreak(6);
                    doc.setFontSize(options.size || 10);
                    doc.setFont(undefined, options.style || 'normal');
                    if (options.color) doc.setTextColor(options.color);
                    doc.text(text, options.x || margin, y, options.textOptions);
                    if (!options.x) y += 6;
                    doc.setTextColor(0, 0, 0);
                };
                
                const drawSummaryTable = () => {
                    const { summary_stats, voltage_compliance, current_compliance, thdv_percent, tdd_percent } = analysisResult;
                    const rowHeight = 7;
                    const col1X = margin;
                    const col2X = margin + 95;

                    const summaryPairs = [
                        ['Voltage Compliance:', voltage_compliance],
                        ['Current Compliance:', current_compliance],
                        ['Average THDv:', `${thdv_percent.toFixed(2)} %`],
                        ['Calculated TDD:', `${tdd_percent.toFixed(2)} %`],
                        ['Avg. Power Factor:', summary_stats.power_factor_avg.toFixed(3)],
                        ['Avg. Active Power:', formatValue(summary_stats.active_power_avg, 'W')],
                        ['Total Active Energy:', formatValue(summary_stats.active_energy_total, 'Wh')],
                    ];

                    doc.setFontSize(10);
                    summaryPairs.forEach(([label, value]) => {
                        checkPageBreak(rowHeight);
                        doc.setFont(undefined, 'bold');
                        drawText(label, { x: col1X });
                        doc.setFont(undefined, 'normal');
                        drawText(value, { x: col1X + 45, textOptions: { align: 'left' } });
                        y += rowHeight;
                    });
                     y += 5;
                };

                const drawChart = (chartRef, width, height) => {
                    if (chartRef.current) {
                        const imgData = chartRef.current.toBase64Image('image/png', 1.0);
                        checkPageBreak(height + 10);
                        doc.addImage(imgData, 'PNG', (docWidth - width) / 2, y, width, height);
                        y += height + 10;
                    }
                };

                drawTitle(`Power Quality Analysis: ${analysisResult.fileName}`);
                y += 5;
                
                drawSectionTitle('Compliance Summary');
                drawSummaryTable();

                if (analysisResult.recommendations?.length > 0) {
                    drawSectionTitle('Recommendations');
                    doc.setFontSize(10);
                    analysisResult.recommendations.forEach(rec => {
                        const lines = doc.splitTextToSize(`• ${rec}`, docWidth - margin * 2);
                        checkPageBreak(lines.length * 5);
                        doc.text(lines, margin, y);
                        y += lines.length * 5 + 2;
                    });
                    y += 5;
                }

                if (Object.keys(analysisResult.failing_points).length > 0) {
                    drawSectionTitle('Key Compliance Issues');
                    doc.setFontSize(10);
                    Object.entries(analysisResult.failing_points).forEach(([category, details]) => {
                        checkPageBreak(8);
                        doc.setFont(undefined, 'bold');
                        drawText(category);
                        doc.setFont(undefined, 'normal');
                        Object.entries(details).forEach(([desc, data]) => {
                            const text = `  - ${desc}${data.phases.length > 0 ? ` (Phases: ${data.phases.join(', ')})` : ''}`;
                            const lines = doc.splitTextToSize(text, docWidth - margin * 2 - 5);
                            checkPageBreak(lines.length * 5);
                            doc.text(lines, margin + 2, y);
                            y += lines.length * 5 + 1;
                        });
                    });
                }

                doc.addPage();
                y = margin;
                drawSectionTitle('Harmonic Spectrums');
                drawChart(vhChartRef, 180, 90);
                drawChart(ahChartRef, 180, 90);

                const typeToTitleMap = {
                    rms: 'RMS Trends',
                    power: 'Power Trends',
                    energy: 'Energy Trends',
                    harmonic: 'Harmonic Trends',
                    power_factor: 'Power Factor Trends',
                    unbalance: 'Unbalance Trends'
                };

                const pageGroups = [
                    ['rms'],
                    ['power'],
                    ['energy'],
                    ['harmonic'],
                    ['power_factor', 'unbalance'] // Group these two together
                ];

                pageGroups.forEach(pageGroup => {
                    const hasAnyChartsOnPage = pageGroup.some(type => 
                        chartGroups.filter(g => g.type === type)
                                   .some(g => trendChartRefs.has(g.title) && trendChartRefs.get(g.title).current)
                    );

                    if (hasAnyChartsOnPage) {
                        doc.addPage();
                        y = margin;

                        pageGroup.forEach(type => {
                            const chartsInGroup = chartGroups.filter(g => g.type === type);
                            const hasChartsInThisSection = chartsInGroup.some(g => trendChartRefs.has(g.title) && trendChartRefs.get(g.title).current);

                            if (hasChartsInThisSection) {
                                drawSectionTitle(typeToTitleMap[type]);
                                chartsInGroup.forEach(group => {
                                    const chartRef = trendChartRefs.get(group.title);
                                    if (chartRef && chartRef.current) {
                                        drawChart(chartRef, 180, 65);
                                    }
                                });
                            }
                        });
                    }
                });

                doc.save('analysis-report.pdf');
            };

            generatePdf().finally(() => {
                setIsPrinting(false);
            });
        }, 500);
    };

    const chartGroups = [
        {type: 'rms',title: 'Line-to-Line Voltage Trends',yAxisLabel: 'Voltage (V)',parentDataKey: 'voltage_ll',childDataKeys: ['U1 RMS', 'U2 RMS', 'U3 RMS']},
        {type: 'rms',title: 'Line-to-Neutral Voltage Trends',yAxisLabel: 'Voltage (V)',parentDataKey: 'voltage_ln',childDataKeys: ['V1 RMS', 'V2 RMS', 'V3 RMS']},
        {type: 'rms',title: 'Current RMS Trends',yAxisLabel: 'Current (A)',parentDataKey: 'current',childDataKeys: ['A1 RMS', 'A2 RMS', 'A3 RMS']},
        {type: 'power', title: 'Active Power Trend',yAxisLabel: 'Power (W)',parentDataKey: 'active_power',childDataKeys: ['W Total']},
        {type: 'power', title: 'Reactive Power Trend',yAxisLabel: 'Power (var)',parentDataKey: 'reactive_power',childDataKeys: ['var Total']},
        {type: 'power', title: 'Apparent Power Trend',yAxisLabel: 'Power (VA)',parentDataKey: 'apparent_power',childDataKeys: ['VA Total']},
        {type: 'energy', title: 'Active Energy Trend',yAxisLabel: 'Energy (Wh)',parentDataKey: 'active_energy',childDataKeys: ['Wh Total']},
        {type: 'energy',title: 'Reactive Energy Trend',yAxisLabel: 'Energy (varh)',parentDataKey: 'reactive_energy',childDataKeys: ['varh Total']},
        {type: 'energy',title: 'Apparent Energy Trend',yAxisLabel: 'Energy (VAh)',parentDataKey: 'apparent_energy',childDataKeys: ['VAh Total']},
        {type: 'harmonic',title: 'Voltage THD Trends',yAxisLabel: 'THD (%)',parentDataKey: 'thdv_percent',childDataKeys: ['U1 THD', 'U2 THD', 'U3 THD']},
        {type: 'harmonic',title: 'Current THD Trends',yAxisLabel: 'THD (%)',parentDataKey: 'thdi_percent',childDataKeys: ['A1 THD', 'A2 THD', 'A3 THD']},
        {type: 'power_factor',title: 'Power Factor Trends',yAxisLabel: 'Power Factor',parentDataKey: 'power_factor',childDataKeys: ['PF1', 'PF2', 'PF3', 'PF Mean']},
        {type: 'unbalance',title: 'Unbalance Trends',yAxisLabel: 'Unbalance (%)',parentDataKey: 'unbalance',childDataKeys: ['Vunb', 'Aunb']}
    ];

    if (!analysisResult) {
        return null;
    }

    const voltageLimit = getVoltageLimit(systemInfo.nominal_voltage);
    const harmonicOrders = analysisResult.bar_chart_data.labels;
    const voltageLimitData = new Array(harmonicOrders.length).fill(voltageLimit);
    const currentLimitData = getCurrentLimitData(systemInfo, harmonicOrders);

    return (
    <div className="results-container" ref={ref}>
        {isPrinting && (
            <div className="printing-overlay">
                <div className="loading-spinner"></div>
                <p>Generating PDF, please wait...</p>
            </div>
        )}
        <div className="report-header">
            <h2>Analysis Results for: {analysisResult.fileName}</h2>
            <button id="export-pdf-button" onClick={handleExportPDF} className="export-button" disabled={isPrinting}>
                {isPrinting ? 'Generating...' : 'Export as PDF'}
            </button>
        </div>
        
        <div id="compliance-summary-section" className="summary-card">
            <div className="summary-header">
                <h3>
                    Compliance Summary
                    <a data-tooltip-id="harmonic-criteria-tooltip">
                        <FaQuestionCircle className="help-icon" />
                    </a>
                    <Tooltip id="harmonic-criteria-tooltip" place="top" effect="solid">
                        <HarmonicCriteriaTooltip systemInfo={systemInfo} />
                    </Tooltip>
                </h3>
            </div>
            <div className="summary-grid-new">
                <div className="summary-col">
                    <SummaryItem label="Voltage Compliance" value={analysisResult.voltage_compliance} />
                    <SummaryItem label="Current Compliance" value={analysisResult.current_compliance} />
                    <SummaryItem label="Average THDv" value={analysisResult.thdv_percent.toFixed(2)} unit="%" />
                    <SummaryItem label="Calculated TDD" value={analysisResult.tdd_percent.toFixed(2)} unit="%" />
                </div>
                <div className="summary-col">
                    <SummaryItem label="Avg. U1 RMS" value={analysisResult.summary_stats.u1_rms_avg.toFixed(2)} unit="V" />
                    <SummaryItem label="Avg. U2 RMS" value={analysisResult.summary_stats.u2_rms_avg.toFixed(2)} unit="V" />
                    <SummaryItem label="Avg. U3 RMS" value={analysisResult.summary_stats.u3_rms_avg.toFixed(2)} unit="V" />
                    <SummaryItem label="Avg. V1 RMS" value={analysisResult.summary_stats.v1_rms_avg.toFixed(2)} unit="V" />
                    <SummaryItem label="Avg. V2 RMS" value={analysisResult.summary_stats.v2_rms_avg.toFixed(2)} unit="V" />
                    <SummaryItem label="Avg. V3 RMS" value={analysisResult.summary_stats.v3_rms_avg.toFixed(2)} unit="V" />
                </div>
                <div className="summary-col">
                    <SummaryItem label="Avg. A1 RMS" value={analysisResult.summary_stats.a1_rms_avg.toFixed(2)} unit="A" />
                    <SummaryItem label="Avg. A2 RMS" value={analysisResult.summary_stats.a2_rms_avg.toFixed(2)} unit="A" />
                    <SummaryItem label="Avg. A3 RMS" value={analysisResult.summary_stats.a3_rms_avg.toFixed(2)} unit="A" />
                    <SummaryItem label="Max A1 RMS" value={analysisResult.summary_stats.a1_rms_max.toFixed(2)} unit="A" />
                    <SummaryItem label="Max A2 RMS" value={analysisResult.summary_stats.a2_rms_max.toFixed(2)} unit="A" />
                    <SummaryItem label="Max A3 RMS" value={analysisResult.summary_stats.a3_rms_max.toFixed(2)} unit="A" />
                </div>
                <div className="summary-col">
                    <SummaryItem label="Avg. P" value={formatValue(analysisResult.summary_stats.active_power_avg, 'W')} />
                    <SummaryItem label="Avg. Q" value={formatValue(analysisResult.summary_stats.reactive_power_avg, 'var')} />
                    <SummaryItem label="Avg. S" value={formatValue(analysisResult.summary_stats.apparent_power_avg, 'VA')} />
                    <SummaryItem label="Avg. PF" value={analysisResult.summary_stats.power_factor_avg.toFixed(3)} />
                </div>
                <div className="summary-col">
                    <SummaryItem label="Total Ep" value={formatValue(analysisResult.summary_stats.active_energy_total, 'Wh')} />
                    <SummaryItem label="Total Eq" value={formatValue(analysisResult.summary_stats.reactive_energy_total, 'varh')} />
                    <SummaryItem label="Total Es" value={formatValue(analysisResult.summary_stats.apparent_energy_total, 'VAh')} />
                </div>
            </div>
        </div>

        {analysisResult.bar_chart_data && (
            <div className="details-card">
                <h3>Harmonic Spectrum Analysis</h3>
                <div id="harmonic-spectrum-section" className="harmonic-charts-container">
                    <HarmonicBarChart 
                        ref={vhChartRef}
                        isPrinting={isPrinting}
                        key={`vh-chart-${chartKey}`}
                        title="Average Voltage Harmonic Spectrum (Overall)"
                        yAxisLabel="THDv (%)"
                        chartData={{
                            labels: analysisResult.bar_chart_data.labels,
                            data: analysisResult.bar_chart_data.vh_data
                        }}
                        limitData={voltageLimitData}
                    />
                    <HarmonicBarChart 
                        ref={ahChartRef}
                        isPrinting={isPrinting}
                        key={`ah-chart-${chartKey}`}
                        title="Average Current Harmonic Spectrum (Overall)"
                        yAxisLabel="THDi (%)"
                        chartData={{
                            labels: analysisResult.bar_chart_data.labels,
                            data: analysisResult.bar_chart_data.ah_data
                        }}
                        limitData={currentLimitData}
                    />
                </div>
            </div>
        )}

        <div style={{ display: isPrinting ? 'none' : 'block' }}>
            {analysisResult.recommendations && (
                <div className="details-card recommendations-card">
                    <h3>Recommendations</h3>
                    <ul>
                        {analysisResult.recommendations.map((rec, index) => <li key={index}>{rec}</li>)}
                    </ul>
                </div>
            )}
            
            {Object.keys(analysisResult.failing_points).length > 0 && (
                <div className="details-card">
                    <h3>Key Compliance Issues Found:</h3>
                    {Object.entries(analysisResult.failing_points).map(([category, details]) => (
                        <div key={category} className="compliance-category">
                            <h4>{category}</h4>
                            <ul>
                                {Object.entries(details).map(([description, data]) => (
                                    <li key={description}>
                                        {description}
                                        {data.phases.length > 0 && (
                                            <span> (Phases: {data.phases.join(', ')})</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
        
        <div style={{ display: isPrinting ? 'none' : 'block' }}>
            <div className="date-picker-container">
                <h3 className="section-title">Filter RMS Trends by Date & Time</h3>
                <div className="date-time-pickers">
                    <div className="date-picker-group">
                        <label>Start:</label>
                        <div className="datetime-picker">
                            <DatePicker selected={startDate} onChange={(date) => setStartDate(date)} selectsStart startDate={startDate} endDate={endDate} dateFormat="yyyy-MM-dd" />
                            <input type="time" step="1" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                    </div>
                    <div className="date-picker-group">
                        <label>End:</label>
                        <div className="datetime-picker">
                            <DatePicker selected={endDate} onChange={(date) => setEndDate(date)} selectsEnd startDate={startDate} endDate={endDate} minDate={startDate} dateFormat="yyyy-MM-dd" />
                            <input type="time" step="1" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                    </div>
                    <button onClick={handleResetTime} className="reset-button">Reset</button>
                </div>
                {timeInterval && <p className="time-interval-display"><strong>Time Interval:</strong> {timeInterval}</p>}
            </div>

            <TrendTabs activeTrendTab={activeTrendTab} setActiveTrendTab={setActiveTrendTab} />
        </div>

        {filteredTrendData ? (
            <div className="trend-chart-container">
                {chartGroups
                    .filter(group => isPrinting || group.type === activeTrendTab)
                    .map(group => {
                        const datasets = group.childDataKeys.map(key => {
                            const data = filteredTrendData[group.parentDataKey]?.[key];
                            if (!data) return null;
                            return {
                                label: key.replace(/_/g, ' ').toUpperCase(),
                                data: data.map((value, index) => ({ x: filteredTrendData.timestamps[index], y: value })),
                                borderColor: generateColorFromString(key),
                                tension: 0.1,
                                pointRadius: 0,
                            };
                        }).filter(Boolean);

                        if (datasets.length === 0) return null;
                        
                        if (!trendChartRefs.has(group.title)) {
                            trendChartRefs.set(group.title, React.createRef());
                        }

                        return (
                            <div 
                                key={`${group.title}-${chartKey}-wrapper`} 
                                className="trend-chart-grid"
                                style={{ display: isPrinting || group.type === activeTrendTab ? 'grid' : 'none' }}
                            >
                                <TrendChart
                                    ref={trendChartRefs.get(group.title)}
                                    key={`${group.title}-${chartKey}`}
                                    title={group.title}
                                    yAxisLabel={group.yAxisLabel}
                                    datasets={datasets}
                                    timestamps={filteredTrendData.timestamps}
                                />
                            </div>
                        );
                    })}
            </div>
        ) : (
            analysisResult && <p className="no-data-message">No data available for the selected time range.</p>
        )}
    </div>
    );
});

export default AnalysisReport;
""