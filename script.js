// Must match what you put in the Arduino code
const MQTT_BROKER = "broker.hivemq.com";
const MQTT_PORT   = 8884;
const MQTT_PATH   = "/mqtt";
const TOPIC_TEMP  = "fardin/sensor/temperature";
const TOPIC_HUMID = "fardin/sensor/humidity";

// UI Elements
const statusEl    = document.getElementById("status");
const displayValueEl = document.getElementById("display-value");
const displayLabelEl = document.getElementById("display-label");
const displayUnitEl  = document.getElementById("display-unit");
const healthBarEl = document.getElementById("health-bar");
const rangeMinEl = document.getElementById("range-min");
const rangeMaxEl = document.getElementById("range-max");
const timestampEl = document.getElementById("timestamp");
const toggleBtns = document.querySelectorAll(".toggle-btn");

// State
let currentDisplay = "temp";  // "temp" or "humid"
let tempValue = null;
let humidValue = null;

const RELOAD_DELAY_MS = 5000;
let reloadTimer = null;

// Create MQTT client
const clientId = "web-" + Math.random().toString(16).substr(2, 8);
const client   = new Paho.MQTT.Client(MQTT_BROKER, parseInt(MQTT_PORT), MQTT_PATH, clientId);

// Message handler
client.onMessageArrived = function(message) {
  const topic   = message.destinationName;
  const payload = message.payloadString;

  if (topic === TOPIC_TEMP) {
    tempValue = parseFloat(payload);
    if (currentDisplay === "temp") updateHealthBar(tempValue, "temp");
  } else if (topic === TOPIC_HUMID) {
    humidValue = parseFloat(payload);
    if (currentDisplay === "humid") updateHealthBar(humidValue, "humid");
  }

  // Update timestamp
  const now = new Date();
  timestampEl.textContent = now.toLocaleTimeString();
};

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
    // Temperature: 25°C = 0%, 35°C = 100%
    minRange = 25;
    maxRange = 35;
  } else {
    // Humidity: 30% = 0%, 70% = 100%
    minRange = 30;
    maxRange = 70;
  }
  
  // Calculate percentage (clamped between 0 and 100)
  percentage = Math.max(0, Math.min(100, ((value - minRange) / (maxRange - minRange)) * 100));
  
  // Update bar width
  healthBarEl.style.width = percentage + "%";
  
  // Update color based on percentage
  const hue = (1 - percentage / 100) * 240; // Blue (240) to Red (0)
  healthBarEl.style.background = `hsl(${hue}, 100%, 50%)`;
}

function switchDisplay(type) {
  currentDisplay = type;
  
  // Update button styles
  toggleBtns.forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.type === type) {
      btn.classList.add("active");
    }
  });
  
  // Update labels and values
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

// Toggle button event listeners
toggleBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    switchDisplay(btn.dataset.type);
  });
});

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
});

window.addEventListener("online", () => {
  cancelReload();
  setStatus("disconnected", "Online — reconnecting...");
  connect();
});

// Start connection
connect();