// Must match what you put in the Arduino code
const MQTT_BROKER = "broker.hivemq.com";
const MQTT_PORT   = 8000;          // WebSocket port (browser can't use 1883)
const TOPIC_TEMP  = "fardin/sensor/temperature";
const TOPIC_HUMID = "fardin/sensor/humidity";

const statusEl    = document.getElementById("status");
const tempEl      = document.getElementById("temp");
const humidEl     = document.getElementById("humid");
const timestampEl = document.getElementById("timestamp");

// Create MQTT client
const clientId = "web-" + Math.random().toString(16).substr(2, 8);
const client   = new Paho.MQTT.Client(MQTT_BROKER, MQTT_PORT, clientId);

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
  setStatus("disconnected", "⚪ Disconnected — retrying...");
  setTimeout(connect, 3000);   // auto-reconnect
};

function connect() {
  setStatus("disconnected", "⚪ Connecting...");
  client.connect({
    onSuccess: function() {
      setStatus("connected", "🟢 Live");
      client.subscribe(TOPIC_TEMP);
      client.subscribe(TOPIC_HUMID);
    },
    onFailure: function(err) {
      setStatus("error", "🔴 Connection failed");
      console.error(err);
      setTimeout(connect, 5000);
    },
    useSSL: false
  });
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