// Must match what you put in the Arduino code
const MQTT_BROKER = "broker.hivemq.com";
const MQTT_PORT   = 8884;
const MQTT_PATH   = "/mqtt";
const TOPIC_TEMP  = "fardin/sensor/temperature";
const TOPIC_HUMID = "fardin/sensor/humidity";

// UI Elements
const statusEl         = document.getElementById("status");
const displayValueEl   = document.getElementById("display-value");
const displayLabelEl   = document.getElementById("display-label");
const displayUnitEl    = document.getElementById("display-unit");
const healthBarEl      = document.getElementById("health-bar");
const rangeMinEl       = document.getElementById("range-min");
const rangeMaxEl       = document.getElementById("range-max");
const timestampEl      = document.getElementById("timestamp");
const toggleBtns       = document.querySelectorAll(".display-toggle-btn");
const chartToggleBtns  = document.querySelectorAll(".chart-toggle-btn");
const chartFrame       = document.querySelector(".chart-frame");
const chartTimestampEl = document.getElementById("chart-timestamp");
const chartCanvas      = document.getElementById("history-chart");
const STORAGE_KEY      = "learnigWeb_sensorHistory";

// State
let currentDisplay      = "temp";  // "temp" or "humid"
let currentChartType    = "temp";
let tempValue           = null;
let humidValue          = null;
const historyMaxPoints  = 24;
const tempHistory       = [];
const humidHistory      = [];
const historyTimestamps = [];
let chartAnimationId    = null;
let chartAnimationStart = 0;
let chartAnimationOldCount = 0;
let chartRenderRaf      = null;
const CHART_ANIMATION_DURATION = 500;

const RELOAD_DELAY_MS = 5000;
let reloadTimer = null;

// Responsive optimization
let resizeDebounceId = null;
let lastKnownChartWidth = null;
const RESIZE_DEBOUNCE_DELAY = 150;

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EFFECTIVE_CHART_ANIMATION_DURATION = prefersReducedMotion ? 100 : CHART_ANIMATION_DURATION;

function saveHistoryToStorage() {
  try {
    const payload = {
      tempHistory,
      humidHistory,
      historyTimestamps,
      currentChartType,
      currentDisplay,
      tempValue,
      humidValue
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Unable to save chart history:", err);
  }
}

function loadHistoryFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed.tempHistory)) {
      tempHistory.splice(0, tempHistory.length, ...parsed.tempHistory.slice(-historyMaxPoints));
    }
    if (Array.isArray(parsed.humidHistory)) {
      humidHistory.splice(0, humidHistory.length, ...parsed.humidHistory.slice(-historyMaxPoints));
    }
    if (Array.isArray(parsed.historyTimestamps)) {
      historyTimestamps.splice(0, historyTimestamps.length, ...parsed.historyTimestamps.slice(-historyMaxPoints));
    }
    if (parsed.currentChartType === "temp" || parsed.currentChartType === "humid") {
      currentChartType = parsed.currentChartType;
    }
    if (parsed.currentDisplay === "temp" || parsed.currentDisplay === "humid") {
      currentDisplay = parsed.currentDisplay;
    }
    if (typeof parsed.tempValue === "number") {
      tempValue = parsed.tempValue;
    }
    if (typeof parsed.humidValue === "number") {
      humidValue = parsed.humidValue;
    }

    if (chartToggleBtns.length) {
      chartToggleBtns.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.type === currentChartType);
      });
    }

    if (toggleBtns.length) {
      toggleBtns.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.type === currentDisplay);
      });
    }

    if (historyTimestamps.length) {
      updateHistoryChart();
    }
  } catch (err) {
    console.warn("Unable to load chart history:", err);
  }
}

// Create MQTT client
const clientId = "web-" + Math.random().toString(16).substr(2, 8);
const client   = new Paho.MQTT.Client(MQTT_BROKER, parseInt(MQTT_PORT), MQTT_PATH, clientId);

// Message handler
client.onMessageArrived = function(message) {
  const topic   = message.destinationName;
  const payload = message.payloadString;
  const now     = new Date();

  if (topic === TOPIC_TEMP) {
    tempValue = parseFloat(payload);
    appendHistory("temp", tempValue, now);
    saveHistoryToStorage();
    if (currentDisplay === "temp") updateHealthBar(tempValue, "temp");
    if (currentChartType === "temp") startChartAnimation();
  } else if (topic === TOPIC_HUMID) {
    humidValue = parseFloat(payload);
    appendHistory("humid", humidValue, now);
    saveHistoryToStorage();
    if (currentDisplay === "humid") updateHealthBar(humidValue, "humid");
    if (currentChartType === "humid") startChartAnimation();
  }

  timestampEl.textContent = now.toLocaleTimeString();
  chartTimestampEl.textContent = now.toLocaleTimeString();
  requestChartRender();
};

function appendHistory(type, value, now) {
  if (type === "temp") {
    tempHistory.push(value);
    chartAnimationOldCount = tempHistory.length > historyMaxPoints ? historyMaxPoints : tempHistory.length - 1;
  } else {
    humidHistory.push(value);
    chartAnimationOldCount = humidHistory.length > historyMaxPoints ? historyMaxPoints : humidHistory.length - 1;
  }

  historyTimestamps.push(now.toLocaleTimeString());

  while (historyTimestamps.length > historyMaxPoints) {
    historyTimestamps.shift();
  }
  while (tempHistory.length > historyMaxPoints) {
    tempHistory.shift();
  }
  while (humidHistory.length > historyMaxPoints) {
    humidHistory.shift();
  }
}

client.onConnectionLost = function(response) {
  if (!navigator.onLine) {
    setStatus("offline", "Offline — waiting for internet...");
    scheduleReload(RELOAD_DELAY_MS);
    return;
  }
  setStatus("disconnected", "Disconnected — retrying...");
  setTimeout(connect, 3000);
};

function connect() {
  if (!navigator.onLine) {
    setStatus("offline", "Offline — reconnect when internet returns");
    scheduleReload(RELOAD_DELAY_MS);
    return;
  }

  cancelReload();
  setStatus("disconnected", "Connecting...");
  client.connect({
    onSuccess: function() {
      setStatus("connected", "Live");
      client.subscribe(TOPIC_TEMP);
      client.subscribe(TOPIC_HUMID);
    },
    onFailure: function(err) {
      if (!navigator.onLine) {
        setStatus("offline", "Offline — waiting for internet...");
        scheduleReload(RELOAD_DELAY_MS);
      } else {
        setStatus("error", "Connection failed — retrying...");
        setTimeout(connect, 5000);
      }
      console.error("MQTT Connection Error:", err);
    },
    useSSL: true,
    cleanSession: true
  });
}

function updateHealthBar(value, type) {
  displayValueEl.textContent = value.toFixed(1);
  
  let percentage, minRange, maxRange;
  if (type === "temp") {
    minRange = 25;
    maxRange = 35;
  } else {
    minRange = 30;
    maxRange = 70;
  }

  percentage = Math.max(0, Math.min(100, ((value - minRange) / (maxRange - minRange)) * 100));
  healthBarEl.style.width = percentage + "%";
  const hue = (1 - percentage / 100) * 240;
  healthBarEl.style.background = `hsl(${hue}, 100%, 50%)`;
}

function switchDisplay(type) {
  currentDisplay = type;
  toggleBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });

  if (type === "temp") {
    displayLabelEl.textContent = "Temperature";
    displayUnitEl.textContent = "°C";
    rangeMinEl.textContent = "25°C";
    rangeMaxEl.textContent = "35°C";
    if (tempValue !== null) {
      updateHealthBar(tempValue, "temp");
    } else {
      displayValueEl.textContent = "--";
      healthBarEl.style.width = "0%";
    }
  } else {
    displayLabelEl.textContent = "Humidity";
    displayUnitEl.textContent = "%";
    rangeMinEl.textContent = "30%";
    rangeMaxEl.textContent = "70%";
    if (humidValue !== null) {
      updateHealthBar(humidValue, "humid");
    } else {
      displayValueEl.textContent = "--";
      healthBarEl.style.width = "0%";
    }
  }
}

function switchChartDisplay(type) {
  if (currentChartType === type) return;

  chartToggleBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });

  chartFrame?.classList.add("chart-transitioning");

  setTimeout(() => {
    currentChartType = type;
    saveHistoryToStorage();
    updateHistoryChart();
    chartFrame?.classList.remove("chart-transitioning");
  }, prefersReducedMotion ? 50 : 200);
}

toggleBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    switchDisplay(btn.dataset.type);
  }, { passive: true });
});

chartToggleBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    switchChartDisplay(btn.dataset.type);
  }, { passive: true });
});

// Debounced resize handler for chart responsiveness
function onWindowResize() {
  if (resizeDebounceId) clearTimeout(resizeDebounceId);
  resizeDebounceId = setTimeout(() => {
    const newWidth = chartCanvas?.clientWidth;
    if (newWidth && newWidth !== lastKnownChartWidth) {
      lastKnownChartWidth = newWidth;
      updateHistoryChart();
    }
    resizeDebounceId = null;
  }, RESIZE_DEBOUNCE_DELAY);
}

window.addEventListener("resize", onWindowResize, { passive: true });

// Initialize the main card display state
switchDisplay(currentDisplay);

function startChartAnimation() {
  cancelChartAnimation();
  chartAnimationStart = performance.now();
  chartAnimationId = requestAnimationFrame(animateChart);
}

function cancelChartAnimation() {
  if (chartAnimationId !== null) {
    cancelAnimationFrame(chartAnimationId);
    chartAnimationId = null;
  }
}

function animateChart(timestamp) {
  const elapsed = timestamp - chartAnimationStart;
  const progress = Math.min(1, elapsed / EFFECTIVE_CHART_ANIMATION_DURATION);
  updateHistoryChart(progress);

  if (progress < 1) {
    chartAnimationId = requestAnimationFrame(animateChart);
  } else {
    chartAnimationId = null;
  }
}

function requestChartRender() {
  if (chartRenderRaf !== null) return;
  chartRenderRaf = requestAnimationFrame(() => {
    chartRenderRaf = null;
    updateHistoryChart();
  });
}

function updateHistoryChart(progress = 1) {
  const ctx = chartCanvas.getContext("2d", { alpha: true });
  const width = chartCanvas.clientWidth;
  const height = window.innerWidth < 480 ? 240 : 320;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap DPR for performance
  
  chartCanvas.width = width * dpr;
  chartCanvas.height = height * dpr;
  chartCanvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);

  const data = currentChartType === "temp" ? tempHistory : humidHistory;
  const labels = historyTimestamps;

  if (data.length === 0) {
    ctx.fillStyle = "#333";
    ctx.font = "14px 'Trebuchet MS', 'Trebuchet', sans-serif";
    ctx.fillText("Waiting for live data...", 16, height / 2);
    return;
  }

  const padding = window.innerWidth < 600 ? 24 : 36;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const valueBuffer = Math.max(1, (maxValue - minValue) * 0.12);
  const minY = minValue - valueBuffer;
  const maxY = maxValue + valueBuffer;

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight * i / 4);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#cb2957";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const pointCount = data.length;
  const oldCount = Math.max(0, pointCount - 1);

  const oldX = index => padding + (chartWidth * index / Math.max(1, oldCount - 1));
  const newX = index => padding + (chartWidth * index / Math.max(1, pointCount - 1));

  const getX = index => {
    if (progress >= 1 || pointCount <= 1) return newX(index);
    if (pointCount === historyMaxPoints) {
      const shiftedIndex = index + 1;
      return oldX(shiftedIndex) + (newX(index) - oldX(shiftedIndex)) * progress;
    }
    return oldX(index) + (newX(index) - oldX(index)) * progress;
  };

  for (let index = 0; index < pointCount; index++) {
    const x = getX(index);
    const normalized = (data[index] - minY) / (maxY - minY);
    const y = padding + chartHeight - normalized * chartHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  const shouldDrawPoints = pointCount <= 12 || window.innerWidth >= 768;
  if (shouldDrawPoints) {
    ctx.fillStyle = "#cb2957";
    for (let index = 0; index < pointCount; index++) {
      const x = getX(index);
      const normalized = (data[index] - minY) / (maxY - minY);
      const y = padding + chartHeight - normalized * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "#000";
  ctx.font = window.innerWidth < 600 ? "12px 'Trebuchet MS', 'Trebuchet', sans-serif" : "14px 'Trebuchet MS', 'Trebuchet', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `${currentChartType === "temp" ? "Temperature" : "Humidity"}: ${data[data.length - 1].toFixed(1)}${currentChartType === "temp" ? "°C" : "%"}`,
    padding,
    20
  );

  ctx.fillStyle = "#5a5a5a";
  ctx.font = "11px 'Trebuchet MS', 'Trebuchet', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(labels[0] || "", width - padding, height - 8);
}

function scheduleReload(delay) {
  if (reloadTimer) return;
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    window.location.reload();
  }, delay);
}

function cancelReload() {
  if (!reloadTimer) return;
  clearTimeout(reloadTimer);
  reloadTimer = null;
}

function setStatus(type, text) {
  statusEl.className = "floating-status " + type;
  statusEl.textContent = text;
}

window.addEventListener("offline", () => {
  setStatus("offline", "Offline — reloading when internet returns...");
  scheduleReload(RELOAD_DELAY_MS);
}, { passive: true });

window.addEventListener("online", () => {
  cancelReload();
  setStatus("disconnected", "Online — reconnecting...");
  connect();
}, { passive: true });

loadHistoryFromStorage();

// Start connection
connect();