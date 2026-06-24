// Must match what you put in the Arduino code
const MQTT_BROKER = "broker.hivemq.com";
const MQTT_PORT   = 8884;          // WebSocket Secure port for HiveMQ
const TOPIC_TEMP  = "fardin/sensor/temperature";
const TOPIC_HUMID = "fardin/sensor/humidity";

const statusEl    = document.getElementById("status");
const tempEl      = document.getElementById("temp");
const humidEl     = document.getElementById("humid");
const timestampEl = document.getElementById("timestamp");

const RELOAD_DELAY_MS = 5000;
let reloadTimer = null;

// Create MQTT client with WebSocket endpoint
const clientId = "web-" + Math.random().toString(16).substr(2, 8);
const client   = new Paho.MQTT.Client("wss://" + MQTT_BROKER + ":" + MQTT_PORT, clientId);

// What to do when a message arrives
client.onMessageArrived = function(message) {
  const topic   = message.destinationName;
  const payload = message.payloadString;

  if (topic === TOPIC_TEMP) {
    flashUpdate(tempEl, payload);
  } else if (topic === TOPIC_HUMID) {
    flashUpdate(humidEl, payload);
  }

  // Update timestamp
  const now = new Date();
  timestampEl.textContent = now.toLocaleTimeString();
};

client.onConnectionLost = function(response) {
  if (!navigator.onLine) {
    setStatus("offline", "⚪ Offline — waiting for internet...");
    scheduleReload(RELOAD_DELAY_MS);
    return;
  }

  setStatus("disconnected", "⚪ Disconnected — retrying...");
  setTimeout(connect, 3000);   // auto-reconnect
};

function connect() {
  if (!navigator.onLine) {
    setStatus("offline", "⚪ Offline — reconnect when internet returns");
    scheduleReload(RELOAD_DELAY_MS);
    return;
  }

  cancelReload();
  setStatus("disconnected", "⚪ Connecting...");
  client.connect({
    onSuccess: function() {
      setStatus("connected", "🟢 Live");
      client.subscribe(TOPIC_TEMP);
      client.subscribe(TOPIC_HUMID);
    },
    onFailure: function(err) {
      if (!navigator.onLine) {
        setStatus("offline", "⚪ Offline — waiting for internet...");
        scheduleReload(RELOAD_DELAY_MS);
      } else {
        setStatus("error", "🔴 Connection failed — retrying...");
        setTimeout(connect, 5000);
      }
      console.error("MQTT Connection Error:", err);
    },
    useSSL: true,
    cleanSession: true
  });
}

window.addEventListener("offline", () => {
  setStatus("offline", "⚪ Offline — reloading when internet returns...");
  scheduleReload(RELOAD_DELAY_MS);
});

window.addEventListener("online", () => {
  cancelReload();
  setStatus("disconnected", "⚪ Online — reconnecting...");
  connect();
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

function flashUpdate(element, value) {
  element.textContent = value;
  element.classList.add("updated");
  setTimeout(() => element.classList.remove("updated"), 800);
}

function setStatus(type, text) {
  statusEl.className = "status " + type;
  statusEl.textContent = text;
}

// Start connection
connect();