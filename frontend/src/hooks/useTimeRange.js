import { useState, useEffect, useCallback } from 'react';
import { calculateTimeInterval } from '../utils';

export const useTimeRange = (analysisResult) => {
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [startTime, setStartTime] = useState('00:00:00');
    const [endTime, setEndTime] = useState('23:59:59');
    const [timeInterval, setTimeInterval] = useState('');

    const resetTimeRange = useCallback(() => {
        const timestamps = analysisResult?.trend_data?.timestamps;
        if (timestamps && timestamps.length > 0) {
            const firstDate = new Date(timestamps[0]);
            const lastDate = new Date(timestamps[timestamps.length - 1]);
            setStartDate(firstDate);
            setEndDate(lastDate);
            setStartTime(firstDate.toTimeString().split(' ')[0]);
            setEndTime(lastDate.toTimeString().split(' ')[0]);
        }
    }, [analysisResult]);

    useEffect(() => {
        resetTimeRange();
    }, [analysisResult, resetTimeRange]);

    useEffect(() => {
        setTimeInterval(calculateTimeInterval(startDate, endDate, startTime, endTime));
    }, [startDate, endDate, startTime, endTime]);

    return {
        startDate, setStartDate,
        endDate, setEndDate,
        startTime, setStartTime,
        endTime, setEndTime,
        timeInterval,
        handleResetTime: resetTimeRange,
    };
};