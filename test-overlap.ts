import { getAvailableTimesForDateStr } from './src/app/bot/actions';

// mock data based on the API output
const psychoId = 'test';
const dateStr = '2026-03-01';
const slots = [
    {
        id: "cmm3yzs030004115sijgm6qo3",
        dayOfWeek: 0,
        startTime: "14:00",
        endTime: "18:00",
        duration: 60,
        format: "both",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-31T00:00:00.000Z",
    },
    {
        id: "cmm3yzrzv0002115spqz1h6lq",
        dayOfWeek: 0,
        startTime: "10:00",
        endTime: "13:00",
        duration: 60,
        format: "both",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-31T00:00:00.000Z",
    }
];

const sessions: any[] = [];
const sessionBreak = 15;

const googleBlocks = [
    {
        date: "2026-03-01",
        startTime: "07:00",
        endTime: "07:50"
    },
    {
        date: "2026-03-02",
        startTime: "07:00",
        endTime: "07:50"
    },
    {
        date: "2026-03-02",
        startTime: "08:00",
        endTime: "08:50"
    }
];

console.log("Testing with blocks:", googleBlocks);
const available = getAvailableTimesForDateStr(psychoId, dateStr, slots, googleBlocks, sessions, sessionBreak);
console.log("Available:", available);
