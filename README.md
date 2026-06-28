# DHT Dashboard

A simple ESP32 + DHT sensor dashboard that shows live temperature and humidity readings in your browser.

> Disclaimer: this project was built mostly by vibe coding, with a focus on quick setup and experimentation rather than production polish.

## What this project includes

- `ide.ino` — ESP32 sketch that reads a DHT sensor and publishes temperature/humidity to MQTT.
- `index.html` — browser dashboard UI that receives values via MQTT over WebSockets.
- `script.js` — MQTT connection logic, display updates, and chart rendering.
- `style.css` — dashboard styling.

## Hardware

### Components

- ESP32 development board
- DHT22 (or DHT11) sensor module or breakout
- Jumper wires
- Optional: 10k pull-up resistor (needed for bare DHT sensor data line)

### Wiring

Use the following wiring for a DHT22 with the ESP32:

- `DHT VCC` → `ESP32 3.3V`
- `DHT GND` → `ESP32 GND`
- `DHT DATA` → `ESP32 GPIO32`

If you are using a bare DHT sensor (not a module with built-in pull-up), add a 10k resistor between `DATA` and `VCC`.

> Note: The sketch currently defines `DHTTYPE` as `DHT22`. If you use a DHT11 instead, change `#define DHTTYPE DHT22` to `#define DHTTYPE DHT11` in `ide.ino`.

## Software setup

### 1. Configure the ESP32 sketch

Open `ide.ino` in the Arduino IDE and update the following settings:

- `ssid` — your Wi-Fi network name
- `password` — your Wi-Fi password
- `mqtt_server` — MQTT broker host
- `mqtt_port` — broker port (default is `1883` for plain MQTT)

The sketch publishes data to MQTT topics. In this example they are:

- `iscream/sensor/temperature`
- `iscream/sensor/humidity`

These are just example topic names. Replace them with your own unique topic names in both `ide.ino` and `script.js`.

### 2. Upload the sketch to ESP32

1. Install the Arduino ESP32 board support in the Arduino IDE.
2. Install the `DHT sensor library` and `PubSubClient` library.
3. Connect the ESP32 to your computer.
4. Select the correct board and port.
5. Upload `ide.ino`.

### 3. Run the dashboard

The dashboard is a static webpage. To avoid browser restrictions, serve it from a local server:

```bash
cd /workspaces/LearnigWeb
python3 -m http.server 8000
```

Then open the browser at:

```text
http://localhost:8000
```

### 4. MQTT dashboard configuration

The browser dashboard connects using the MQTT WebSocket configuration in `script.js`:

- `MQTT_BROKER` — `broker.hivemq.com`
- `MQTT_PORT` — `8884`
- `MQTT_PATH` — `/mqtt`
- `TOPIC_TEMP` — `iscream/sensor/temperature` 
- `TOPIC_HUMID` — `iscream/sensor/humidity` 

Do not use these exact topic names unless you want to publish to the same topics. Replace them with your own unique topics in both `ide.ino` and `script.js`.

## How to use

- Open the dashboard in a browser.
- Wait until the top status indicator says `Live`.
- Use the buttons to switch between temperature and humidity display.
- The chart shows the latest history for the selected sensor type.

## Customization

- To change the displayed sensor pin, edit `#define DHTPIN 32` in `esp32_dht.ino`.
- To use a different MQTT topic, update both `esp32_dht.ino` and `script.js` with the same topic names.
- To use a different broker, update the MQTT settings in both files.

## Troubleshooting

- If the dashboard does not update, verify the ESP32 is connected to Wi-Fi and publishing to MQTT.
- Check the Arduino Serial Monitor for sensor read or MQTT connection errors.
- Open the browser console to see WebSocket/MQTT errors.
- Make sure the browser can reach the WebSocket broker port and path.

## Notes

This dashboard assumes the ESP32 sends temperature and humidity values as plain numeric strings from the DHT sensor. The webpage renders those values in real time and keeps a short local history in the browser.

