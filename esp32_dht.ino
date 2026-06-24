#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ===== CONFIGURE THESE =====
const char* ssid     = "Connect";
const char* password = "789632145";

// HiveMQ free public broker (no account needed to test)
const char* mqtt_server = "broker.hivemq.com";
const int   mqtt_port   = 1883;

// Topic names — must match your webpage exactly
const char* topic_temp  = "fardin/sensor/temperature";
const char* topic_humid = "fardin/sensor/humidity";
// ===========================

#define DHTPIN 32
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    // Random client ID so multiple devices don't clash
    String clientId = "ESP32-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("connected!");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5s");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // Read sensor every 5 seconds
  static unsigned long lastMsg = 0;
  if (millis() - lastMsg > 5000) {
    lastMsg = millis();

    float temp  = dht.readTemperature();   // Celsius
    float humid = dht.readHumidity();

    if (isnan(temp) || isnan(humid)) {
      Serial.println("Sensor read failed!");
      return;
    }

    // Convert to string and publish
    char tempStr[8];
    char humidStr[8];
    dtostrf(temp,  4, 1, tempStr);
    dtostrf(humid, 4, 1, humidStr);

    client.publish(topic_temp,  tempStr);
    client.publish(topic_humid, humidStr);

    Serial.printf("Published → Temp: %s°C  Humidity: %s%%\n", tempStr, humidStr);
  }
}
