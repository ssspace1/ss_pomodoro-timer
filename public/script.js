// 要素取得
const timerDisplay = document.querySelector('.timer-display');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const workInput = document.getElementById('workTime');
const breakInput = document.getElementById('breakTime');
const taskNameInput = document.getElementById('taskName');

let isWorkMode = true;
let remainingSeconds = 25 * 60;
let timerInterval = null;

function updateDisplay() {
  const min = String(Math.floor(remainingSeconds/60)).padStart(2,'0');
  const sec = String(remainingSeconds%60).padStart(2,'0');
  timerDisplay.textContent = `${min}:${sec}`;
}

function tick() {
  remainingSeconds--;
  updateDisplay();
  if (remainingSeconds <= 0) {
    clearInterval(timerInterval);
    timerInterval = null;
    onSessionEnd();
  }
}

function startTimer() {
  if (timerInterval) return; 
  timerInterval = setInterval(tick, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  pauseTimer();
  isWorkMode = true;
  remainingSeconds = parseInt(workInput.value,10)*60;
  updateDisplay();
}

function onSessionEnd() {
  // セッション終了時の記録送信
  const duration = isWorkMode ? parseInt(workInput.value,10) : parseInt(breakInput.value,10);
  const mode = isWorkMode ? 'Work' : 'Break';
  const taskName = taskNameInput.value.trim();

  sendSessionDataToServer(duration, mode, taskName);

  // モード切替
  isWorkMode = !isWorkMode;
  remainingSeconds = (isWorkMode ? parseInt(workInput.value,10) : parseInt(breakInput.value,10))*60;
  updateDisplay();
}

function sendSessionDataToServer(duration, mode, task) {
  fetch('/api/record-session', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      duration,
      mode,
      task
    })
  })
  .then(res => res.json())
  .then(data => console.log('Recorded:', data))
  .catch(err => console.error('Error recording session:', err));
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// 初期表示更新
resetTimer();
