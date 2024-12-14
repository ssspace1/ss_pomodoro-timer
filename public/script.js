// script.js

// ==========================
// 基本設定・変数定義
// ==========================
let userSettings = {
  pomodoro: 25,
  short: 5,
  long: 10,
  playSound: true,
  theme: "default",
  autoRecordDaily: false,
  dayResetTime: "00:00" // ユーザーが1日の区切り時刻を設定できる
};

let isClockRunning = false;
let isClockStopped = true;
let currentTimerType = "pomodoro";
let currentTimeLeftInSession = userSettings.pomodoro * 60;
let timerInterval = null;

let workLogs = [];
let dailyWorkLog = { date: getTodayDateStr(), totalWorkSeconds: 0 };

// ポモドーロ開始時刻(Workモード時)
let workSessionStart = null;

// 要素取得（HTML側と対応済みとする）
const dailyWorkDisplay = document.getElementById('dailyWorkDisplay');
const timerDisplay = document.getElementById('pomodoro-timer');
const startBtn = document.getElementById('pomodoro-start');
const stopBtn = document.getElementById('pomodoro-stop');
const settingsBtn = document.getElementById('pomodoro-settings');
const statsBtn = document.getElementById('pomodoro-stats');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');

const settingsModal = document.getElementById('settingsModal');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

const pomodoroLengthInput = document.getElementById('pomodoroLength');
const shortBreakLengthInput = document.getElementById('shortBreakLength');
const longBreakLengthInput = document.getElementById('longBreakLength');
const playSoundCheck = document.getElementById('playSoundCheck');
const themeSelect = document.getElementById('themeSelect');
const autoRecordDailyCheck = document.getElementById('autoRecordDailyCheck');

const dayResetTimeInput = document.getElementById('dayResetTimeInput'); // HTMLで追加済みを想定
const recordNowBtn = document.getElementById('recordNowBtn');

const statsModal = document.getElementById('statsModal');
const closeStatsBtn = document.getElementById('closeStatsBtn');
const statsDailyTotal = document.getElementById('statsDailyTotal');
const statsWeeklyList = document.getElementById('statsWeeklyList');
const statsMonthlyList = document.getElementById('statsMonthlyList');

const alertSound = new Audio("https://example.com/chime.mp3");
alertSound.volume = 1.0;

// Notification許可要請
if (Notification && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ==========================
// 関数定義
// ==========================

function loadWorkLogs() {
  const w = localStorage.getItem('workLogs');
  if (w) {
    workLogs = JSON.parse(w);
  } else {
    workLogs = [];
  }
  // 現在の日付(基準時刻考慮)
  const today = getTodayDateStr();
  let todayLog = workLogs.find(l => l.date === today);
  if (!todayLog) {
    todayLog = { date: today, totalWorkSeconds: 0 };
    workLogs.push(todayLog);
    saveWorkLogs();
  }
  dailyWorkLog = todayLog;
}

function saveWorkLogs() {
  localStorage.setItem('workLogs', JSON.stringify(workLogs));
}

function updateDailyWorkTimeDisplay() {
  dailyWorkDisplay.textContent = formatTime(dailyWorkLog.totalWorkSeconds);
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
}

// Day Start Hour考慮して今日の日付を返す
function getTodayDateStr() {
  const now = new Date();
  const [resetH, resetM] = userSettings.dayResetTime.split(':').map(n => parseInt(n, 10));

  // 今日のreset時刻
  const resetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetH, resetM);

  // nowがresetTodayより前なら"昨日"として扱う
  // つまり、reset時刻を過ぎて初めて新しい日が始まる
  let effectiveDate = new Date(now);
  if (now < resetToday) {
    effectiveDate.setDate(effectiveDate.getDate() - 1);
  }

  return effectiveDate.getFullYear() + '-' +
    String(effectiveDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(effectiveDate.getDate()).padStart(2, '0');
}

function getInitialTimeForMode() {
  const mode = document.querySelector('input[name="timerType"]:checked').value;
  currentTimerType = mode;
  let t = userSettings.pomodoro;
  if (mode === 'short') t = userSettings.short;
  if (mode === 'long') t = userSettings.long;
  return t * 60;
}

function updateTimerDisplay() {
  const min = String(Math.floor(currentTimeLeftInSession / 60)).padStart(2, '0');
  const sec = String(currentTimeLeftInSession % 60).padStart(2, '0');
  timerDisplay.textContent = `${min}:${sec}`;
}

function tick() {
  currentTimeLeftInSession--;
  updateTimerDisplay();
  if (currentTimeLeftInSession <= 0) {
    clearInterval(timerInterval);
    timerInterval = null;
    onTimerEnd();
  }
}

function onTimerStart() {
  if (currentTimerType === 'pomodoro') {
    workSessionStart = Date.now();
  } else {
    workSessionStart = null;
  }
}

function onTimerStopOrPause() {
  if (workSessionStart && currentTimerType === 'pomodoro') {
    const elapsed = Math.floor((Date.now() - workSessionStart) / 1000);
    addElapsedToDailyLog(elapsed);
    updateDailyWorkTimeDisplay();
    workSessionStart = null;
  }
}

function addElapsedToDailyLog(elapsedSec) {
  dailyWorkLog.totalWorkSeconds += elapsedSec;
  saveWorkLogs();
}

function onTimerEnd() {
  if (userSettings.playSound) {
    alertSound.currentTime = 0;
    alertSound.play();
  }

  if (Notification.permission === 'granted') {
    new Notification("Pomodoro Finished!", { body: "Time for a break!" });
  }

  // pomodoroの場合のみ記録
  if (currentTimerType === 'pomodoro' && workSessionStart) {
    const end = Date.now();
    const elapsedSec = Math.floor((end - workSessionStart) / 1000);
    addElapsedToDailyLog(elapsedSec);
    updateDailyWorkTimeDisplay();
    workSessionStart = null;

    const durationInMin = Math.round(elapsedSec / 60);
    const timestamp = new Date().toISOString();
    const mode = "Work";
    const task = "Pomo Session"; // タスク名固定

    sendSessionToNotion(timestamp, durationInMin, mode, task);
  }

  // short or long break終了時はpomodoroに戻す
  if (currentTimerType === 'short' || currentTimerType === 'long') {
    document.querySelector('input[name="timerType"][value="pomodoro"]').checked = true;
  }

  // 日付切り替えチェック
  checkDayChange();

  toggleClock(true);
}

function toggleClock(reset) {
  if (reset) {
    isClockStopped = true;
    isClockRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    currentTimeLeftInSession = getInitialTimeForMode();
    updateTimerDisplay();
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');

    onTimerStopOrPause();
    // リセット時も日付変更チェック
    checkDayChange();
    return;
  }

  if (isClockRunning) {
    // 一時停止
    isClockRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
  } else {
    // 開始
    if (isClockStopped) {
      currentTimeLeftInSession = getInitialTimeForMode();
      updateTimerDisplay();
      isClockStopped = false;
    }
    isClockRunning = true;
    onTimerStart();
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    timerInterval = setInterval(tick, 1000);
  }
}

// 日付切り替えチェック：dayResetTime過ぎて日付が変わったらリセット
function checkDayChange() {
  const currentDay = getTodayDateStr();
  if (dailyWorkLog.date !== currentDay) {
    dailyWorkLog = { date: currentDay, totalWorkSeconds: 0 };
    saveWorkLogs();
    updateDailyWorkTimeDisplay();
    console.log("Day changed based on Day Start Hour, Today's Work reset.");
  }
}

function sendSessionToNotion(timestamp, durationInMin, mode, task) {
  fetch('/api/record-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, duration: durationInMin, mode, task })
  })
    .then(res => res.json())
    .then(data => {
      if (data.message === "Success") {
        console.log("Notionへの記録成功:", data);
      } else {
        console.error("Notion記録失敗:", data);
      }
    })
    .catch(err => {
      console.error("Notion記録中エラー:", err);
    });
}

// Now Recordボタン
recordNowBtn.addEventListener('click', () => {
  if (currentTimerType === 'pomodoro' && workSessionStart) {
    const elapsedSec = Math.floor((Date.now() - workSessionStart) / 1000);
    const durationInMin = Math.round(elapsedSec / 60);
    const timestamp = new Date().toISOString();
    const mode = "Work";
    const task = "Pomo Session";
    sendSessionToNotion(timestamp, durationInMin, mode, task);
  } else {
    console.log("No ongoing work session to record");
  }
});

// 統計関連
function updateStatsModal() {
  statsDailyTotal.textContent = formatTime(dailyWorkLog.totalWorkSeconds);
  populateStatsList(statsWeeklyList, getPastDaysData(7));
  populateStatsList(statsMonthlyList, getPastDaysData(30));
}

function getPastDaysData(days) {
  const now = new Date();
  let result = [];
  for (let i = 0; i < days; i++) {
    let d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    let log = workLogs.find(l => l.date === dateStr);
    if (!log) log = { date: dateStr, totalWorkSeconds: 0 };
    result.push(log);
  }
  result.sort((a, b) => a.date > b.date ? 1 : -1);
  return result;
}

function populateStatsList(container, data) {
  container.innerHTML = '';
  let maxSec = 0;
  data.forEach(d => { if (d.totalWorkSeconds > maxSec) maxSec = d.totalWorkSeconds; });
  if (maxSec === 0) maxSec = 1;

  data.forEach(d => {
    const row = document.createElement('div');
    row.classList.add('day-row');

    const dateSpan = document.createElement('div');
    dateSpan.classList.add('day-date');
    dateSpan.textContent = d.date;

    const timeSpan = document.createElement('div');
    timeSpan.classList.add('day-time');
    timeSpan.textContent = formatTime(d.totalWorkSeconds);

    const barContainer = document.createElement('div');
    barContainer.classList.add('bar-container');

    const bar = document.createElement('div');
    bar.classList.add('bar');
    const pct = (d.totalWorkSeconds / maxSec) * 100;
    bar.style.width = pct + '%';

    barContainer.appendChild(bar);

    row.appendChild(dateSpan);
    row.appendChild(timeSpan);
    row.appendChild(barContainer);

    container.appendChild(row);
  });
}

function applyTheme(theme) {
  const bgWrapper = document.getElementById('bg-wrapper');
  if (theme === 'auto') {
    applyAutoTheme();
  } else if (theme === 'forest') {
    bgWrapper.style.backgroundColor = '#334f33';
  } else if (theme === 'cafe') {
    bgWrapper.style.backgroundColor = '#4f3f33';
  } else if (theme === 'night') {
    bgWrapper.style.backgroundColor = '#3a3a3a';
  } else {
    bgWrapper.style.backgroundColor = '#222';
  }
}

function applyAutoTheme() {
  const bgWrapper = document.getElementById('bg-wrapper');
  const hour = new Date().getHours();
  let color;
  if (hour >= 0 && hour < 3) color = '#2f2f2f';
  else if (hour >= 3 && hour < 6) color = '#33404f';
  else if (hour >= 6 && hour < 9) color = '#8799a1';
  else if (hour >= 9 && hour < 12) color = '#b0bec5';
  else if (hour >= 12 && hour < 15) color = '#cfd8dc';
  else if (hour >= 15 && hour < 18) color = '#d3b89f';
  else if (hour >= 18 && hour < 21) color = '#556a71';
  else color = '#3a3a3a';

  bgWrapper.style.backgroundColor = color;
}

function loadUserSettings() {
  const s = localStorage.getItem('userSettings');
  if (s) userSettings = JSON.parse(s);
}

function saveUserSettings() {
  localStorage.setItem('userSettings', JSON.stringify(userSettings));
}

// 手動でToday's Workリセットボタン（設定モーダル内で追加する）
function addManualResetButton() {
  const modalActions = settingsModal.querySelector('.modal-actions');
  const resetTodayBtn = document.createElement('button');
  resetTodayBtn.textContent = "Reset Today's Work";
  resetTodayBtn.classList.add('btn');
  resetTodayBtn.addEventListener('click', () => {
    dailyWorkLog = { date: getTodayDateStr(), totalWorkSeconds: 0 };
    saveWorkLogs();
    updateDailyWorkTimeDisplay();
    console.log("Today's Work reset manually.");
  });
  modalActions.insertBefore(resetTodayBtn, modalActions.firstChild);
}

// イベントリスナー
const timerTypeInputs = document.querySelectorAll('input[name="timerType"]');
timerTypeInputs.forEach(input => {
  input.addEventListener('change', () => {
    onTimerStopOrPause();
    toggleClock(true);
  });
});

startBtn.addEventListener('click', () => toggleClock(false));
stopBtn.addEventListener('click', () => toggleClock(true));

settingsBtn.addEventListener('click', () => {
  pomodoroLengthInput.value = userSettings.pomodoro;
  shortBreakLengthInput.value = userSettings.short;
  longBreakLengthInput.value = userSettings.long;
  playSoundCheck.checked = userSettings.playSound;
  themeSelect.value = userSettings.theme;
  autoRecordDailyCheck.checked = userSettings.autoRecordDaily;
  dayResetTimeInput.value = userSettings.dayResetTime;
  settingsModal.classList.remove('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
  userSettings.pomodoro = parseInt(pomodoroLengthInput.value, 10);
  userSettings.short = parseInt(shortBreakLengthInput.value, 10);
  userSettings.long = parseInt(longBreakLengthInput.value, 10);
  userSettings.playSound = playSoundCheck.checked;
  userSettings.theme = themeSelect.value;
  userSettings.autoRecordDaily = autoRecordDailyCheck.checked;
  userSettings.dayResetTime = dayResetTimeInput.value;
  saveUserSettings();
  applyTheme(userSettings.theme);
  settingsModal.classList.add('hidden');
  // 日付変更の可能性もあるので再チェック
  checkDayChange();
});

closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

statsBtn.addEventListener('click', () => {
  updateStatsModal();
  statsModal.classList.remove('hidden');
});
closeStatsBtn.addEventListener('click', () => statsModal.classList.add('hidden'));

const statsTabBtns = document.querySelectorAll('.stats-tab-btn');
const statsTabPanes = document.querySelectorAll('.stats-tab-pane');
statsTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    statsTabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    statsTabPanes.forEach(p => p.classList.remove('active'));
    document.querySelector(btn.dataset.target).classList.add('active');
  });
});

document.addEventListener('DOMContentLoaded', () => {
  loadUserSettings();
  loadWorkLogs();
  applyTheme(userSettings.theme);
  updateDailyWorkTimeDisplay();
  updateTimerDisplay();

  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');

  const toggleDailyWorkBtn = document.getElementById('toggleDailyWork');
  const dailyWorkTime = document.getElementById('daily-work-time');
  let dailyWorkVisible = true;
  toggleDailyWorkBtn.addEventListener('click', () => {
    dailyWorkVisible = !dailyWorkVisible;
    dailyWorkTime.style.display = dailyWorkVisible ? 'inline-block' : 'none';
    toggleDailyWorkBtn.innerHTML = dailyWorkVisible ?
      `
    <svg width="24" height="24" stroke="#fff" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    `
      :
      `
    <svg width="24" height="24" stroke="#fff" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M2 2l20 20M9.88 9.88a3 3 0 014.24 4.24"/>
      <path d="M1 12s4-7 11-7c2.5 0 4.78.75 6.65 2M23 12s-4 7-11 7c-2.5 0-4.78-.75-6.65-2"/>
    </svg>
    `;
  });

  // 手動リセットボタン追加
  addManualResetButton();
});

