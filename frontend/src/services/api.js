import axios from 'axios';
import { API_BASE_URL } from '../constants';

export const analyzePowerQuality = async (file, systemInfo) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const params = new URLSearchParams(systemInfo);
  const API_URL = `${API_BASE_URL}/analyze/?${params.toString()}`;

  try {
    const response = await axios.post(API_URL, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    console.log('%c[1] DATA FROM BACKEND:', 'color: blue; font-weight: bold;', response.data);
    return response.data;
  } catch (err) {
    console.error('[ERROR] Analysis failed:', err);
    throw new Error(err.response?.data?.detail || 'An unexpected error occurred during analysis.');
  }
};