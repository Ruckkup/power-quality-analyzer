import React from 'react';
import { Tooltip } from 'react-tooltip';
import { FaQuestionCircle } from "react-icons/fa";

const SystemInfoForm = ({ systemInfo, handleInputChange, handleSubmit, handleFileChange, isLoading }) => (
  <form onSubmit={handleSubmit} className="system-info-form">
    <h2 className="system-info-form__title">1. System Information (at PCC)</h2>
    <div className="system-info-form__grid--3-col">
      <div className="form-group">
        <label htmlFor="nominal_voltage">
          Nominal Voltage (V):
          <a data-tooltip-id="nominal-voltage-tooltip" data-tooltip-content="The standard voltage of the system (e.g., 400V, 690V, 11kV). Used to determine the correct IEEE 519 voltage limits.">
            <FaQuestionCircle className="help-icon-form" />
          </a>
        </label>
        <input type="number" id="nominal_voltage" name="nominal_voltage" value={systemInfo.nominal_voltage} onChange={handleInputChange} required />
      </div>
      <div className="form-group">
        <label htmlFor="isc">
          Short Circuit Current, Isc (A):
          <a data-tooltip-id="isc-tooltip" data-tooltip-content="The maximum possible current at the Point of Common Coupling (PCC). It helps determine the system's strength. Can be found in system design documents.">
            <FaQuestionCircle className="help-icon-form" />
          </a>
        </label>
        <input type="number" id="isc" name="isc" value={systemInfo.isc} onChange={handleInputChange} required />
      </div>
      <div className="form-group">
        <label htmlFor="il">
          Max Demand Load Current, IL (A):
          <a data-tooltip-id="il-tooltip" data-tooltip-content="The average current of the maximum demand over 15 or 30 minutes. It's used with Isc to determine the harmonic current limits.">
            <FaQuestionCircle className="help-icon-form" />
          </a>
        </label>
        <input type="number" id="il" name="il" value={systemInfo.il} onChange={handleInputChange} required />
      </div>
      <div>
      </div>
    </div>
    <h2 className="system-info-form__title">2. Upload Data File (.xlsx)</h2>
    <p>Ensure file contains sheets: 'Trend', 'Vh Harmonic %', 'Ah Harmonic %'.</p>
    <div className="form-group">
      <label htmlFor="file">Upload File:</label>
      <input type="file" id="file" name="file" onChange={handleFileChange} accept=".xlsx" required />
    </div>
    <button type="submit" className="system-info-form__button" disabled={isLoading}>
      {isLoading && <div className="loading-spinner"></div>}
      {isLoading ? 'Analyzing...' : 'Analyze Now'}
    </button>
    <Tooltip id="nominal-voltage-tooltip" place="top" effect="solid" />
    <Tooltip id="isc-tooltip" place="top" effect="solid" />
    <Tooltip id="il-tooltip" place="top" effect="solid" />
  </form>
);

export default SystemInfoForm;