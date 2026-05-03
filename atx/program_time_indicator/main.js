(function () {
    'use strict';

    const CONFIG = {
        TABLE_SELECTOR: '#timeTable',
        TIME_HEAD_SELECTOR: '#timeTableHead',
        TIME_CELL_SELECTOR: 'th.bgYellow',
        HIGHLIGHT_BG_COLOR: '#ff0000',
        HIGHLIGHT_TEXT_COLOR: '#fff',
        LATE_NIGHT_THRESHOLD: 360
    };

    const parseTime = (text) => {
        const match = text.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        return h * 60 + m;
    };

    const getNowMinutes = () => {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    };

    const getTodayColumnIndex = () => {
        const now = new Date();
        let day = now.getDay();
        if (now.getHours() < 6) {
            day = day === 0 ? 6 : day - 1;
        }
        return day === 0 ? 6 : day - 1;
    };

    const shouldRedirectToPreviousWeek = () => {
        if (window.location.pathname !== '/program') return false;
        const now = new Date();
        return now.getDay() === 1 && now.getHours() < 6;
    };

    const redirectToPreviousWeek = () => {
        const prevLink = document.querySelector('li.prev > a');
        if (prevLink) {
            window.location.href = prevLink.href;
        }
    };

    const highlightDayHeader = () => {
        const header = document.querySelector(CONFIG.TIME_HEAD_SELECTOR);
        if (!header) return;
        const ths = header.querySelectorAll('tr > th');
        const colIndex = getTodayColumnIndex();
        if (ths[colIndex]) {
            ths[colIndex].style.backgroundColor = CONFIG.HIGHLIGHT_BG_COLOR;
            ths[colIndex].style.color = CONFIG.HIGHLIGHT_TEXT_COLOR;
        }
    };

    const findTargetTime = (timeCells, adjustedNowMin) => {
        let targetTime = null;
        for (let i = 0; i < timeCells.length; i++) {
            const time = parseTime(timeCells[i].textContent);
            if (time === null) continue;
            if (time > adjustedNowMin) break;
            targetTime = time;
        }
        return targetTime;
    };

    const highlightCells = (timeCells, targetTime) => {
        timeCells.forEach(cell => {
            const time = parseTime(cell.textContent);
            if (time === null) return;
            if (time === targetTime) {
                cell.style.backgroundColor = CONFIG.HIGHLIGHT_BG_COLOR;
                cell.style.color = CONFIG.HIGHLIGHT_TEXT_COLOR;
            }
        });
    };

    const drawTimeLine = () => {
        const table = document.querySelector(CONFIG.TABLE_SELECTOR);
        if (!table) return;

        highlightDayHeader();

        const nowMin = getNowMinutes();
        const isLateNight = nowMin < CONFIG.LATE_NIGHT_THRESHOLD;
        const adjustedNowMin = isLateNight ? nowMin + 24 * 60 : nowMin;
        const timeCells = table.querySelectorAll(CONFIG.TIME_CELL_SELECTOR);

        const targetTime = findTargetTime(timeCells, adjustedNowMin);
        if (targetTime === null) return;

        highlightCells(timeCells, targetTime);
    };

    const init = () => {
        if (shouldRedirectToPreviousWeek()) {
            redirectToPreviousWeek();
            return;
        }
        drawTimeLine();
        console.log('🚀 AT-X 現在時刻ライン が初期化されました');
    };

    init();
})();
