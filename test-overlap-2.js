function toDateStr(d) {
    return d.toISOString().slice(0, 10);
}

function getAvailableTimesForDateStr(psychologistId, dateStr, slots, blocks, sessions, sessionBreak) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const now = new Date('2026-02-26T12:00:00.000Z'); // Fixed now for testing
    const todayStr = toDateStr(now);
    const isToday = dateStr === todayStr;
    const nowHours = now.getHours() + (now.getMinutes() / 60);

    const dayOfWeek = (date.getUTCDay() + 6) % 7;
    console.log("Day of Week:", dayOfWeek);

    const daySlots = slots.filter(s => {
        if (s.dayOfWeek !== dayOfWeek) return false;

        if (s.startDate) {
            const slotStartStr = toDateStr(new Date(s.startDate));
            if (dateStr < slotStartStr) return false;
        }
        if (s.endDate) {
            const slotEndStr = toDateStr(new Date(s.endDate));
            if (dateStr > slotEndStr) return false;
        }
        return true;
    });

    console.log("Filtered Day Slots:", daySlots.length);

    const daySessions = sessions.filter(s => toDateStr(new Date(s.date)) === dateStr);

    let timesObj = {};

    daySlots.forEach(slot => {
        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);
        const duration = slot.duration || 50;

        let currentTotalMins = startH * 60 + startM;
        const endTotalMins = endH * 60 + endM;

        while (currentTotalMins + duration <= endTotalMins) {
            const h = Math.floor(currentTotalMins / 60);
            const m = currentTotalMins % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            if (isToday && (h + m / 60 <= nowHours)) {
                currentTotalMins += duration;
                continue;
            }

            const slotEndTimeMins = currentTotalMins + duration;
            const hasClash = daySessions.some(sess => {
                const [sessH, sessM] = sess.time.split(':').map(Number);
                const sessStartMins = sessH * 60 + sessM;
                const sessEndMins = sessStartMins + (sess.duration || 50);
                return currentTotalMins < sessEndMins && slotEndTimeMins > sessStartMins;
            });

            const hasBlock = blocks.some(b => {
                if (toDateStr(new Date(b.date)) !== dateStr) return false;
                const [bSH, bSM] = b.startTime.split(':').map(Number);
                const [bEH, bEM] = b.endTime.split(':').map(Number);
                const blockStartMins = bSH * 60 + bSM;
                const blockEndMins = bEH * 60 + bEM;
                return currentTotalMins < blockEndMins && slotEndTimeMins > blockStartMins;
            });

            if (!hasClash && !hasBlock) {
                const key = `${timeStr}-${slot.format || 'online'}`;
                if (!timesObj[key]) {
                    timesObj[key] = {
                        time: timeStr,
                        format: slot.format || 'online',
                        addressId: slot.addressId || null
                    };
                }
            } else {
                console.log(`Blocked: ${timeStr} due to clash:${hasClash} block:${hasBlock}`);
            }

            currentTotalMins += duration + sessionBreak;
        }
    });

    return Object.values(timesObj).sort((a, b) => a.time.localeCompare(b.time));
}

const psychoId = 'test';
const dateStr = '2026-03-09';
const slots = [
    {
        dayOfWeek: 0,
        startTime: "10:00",
        endTime: "13:00",
        duration: 60,
        format: "both",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-31T00:00:00.000Z",
    },
    {
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "13:00",
        duration: 60,
        format: "both",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-03-31T00:00:00.000Z",
    }
];

const sessions = [];
const sessionBreak = 15;

const googleBlocks = [
    {
        date: "2026-03-09T00:00:00.000Z",
        startTime: "07:00",
        endTime: "07:50"
    }
];

console.log("Testing with date:", dateStr);
const available = getAvailableTimesForDateStr(psychoId, dateStr, slots, googleBlocks, sessions, sessionBreak);
console.log("Available:", available);
