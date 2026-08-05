const MQTT_BROKER_URL = "wss://broker.hivemq.com:8884/mqtt";
const DEFAULT_TOPIC = "mitschess/mitesptest/servo";
const STORAGE_KEY_TOPIC = "mqttTopic";

const slider = document.getElementById("servoSlider");
const angleReadout = document.getElementById("angleReadout");
const connectionPill = document.getElementById("connectionPill");
const connectionText = document.getElementById("connectionText");
const statusAngle = document.getElementById("statusAngle");
const statusWifi = document.getElementById("statusWifi");
const statusIp = document.getElementById("statusIp");
const settingsForm = document.getElementById("settingsForm");
const mqttTopicInput = document.getElementById("mqttTopic");
const settingsHint = document.getElementById("settingsHint");
const refreshButton = document.getElementById("refreshButton");

let mqttClient;
let publishTimer;
let currentTopic = getTopic();

function getTopic() {
  return localStorage.getItem(STORAGE_KEY_TOPIC) || DEFAULT_TOPIC;
}

function getClientId(prefix) {
  const randomPart = Math.random().toString(16).slice(2);
  return `${prefix}-${randomPart}`;
}

function getAngleTopic() {
  return `${currentTopic}/angle`;
}

function getStatusTopic() {
  return `${currentTopic}/status`;
}

function getCommandTopic() {
  return `${currentTopic}/command`;
}

function setConnectionState(isOnline, label) {
  connectionPill.classList.toggle("online", isOnline);
  connectionPill.classList.toggle("offline", !isOnline);
  connectionText.textContent = label;
}

function setAngle(value) {
  const angle = Math.max(0, Math.min(180, Number(value)));
  slider.value = String(angle);
  angleReadout.textContent = `${angle}\u00b0`;
}

function publish(topic, payload) {
  if (!mqttClient || !mqttClient.connected) {
    setConnectionState(false, "Offline");
    settingsHint.textContent = "MQTT belum terhubung.";
    return;
  }

  mqttClient.publish(topic, payload, { qos: 0, retain: false });
}

function publishAngleDebounced(angle) {
  window.clearTimeout(publishTimer);
  publishTimer = window.setTimeout(() => {
    publish(getAngleTopic(), String(angle));
    statusAngle.textContent = `${angle}\u00b0`;
    settingsHint.textContent = `Angle dikirim ke ${getAngleTopic()}.`;
  }, 80);
}

function handleStatusMessage(payload) {
  try {
    const data = JSON.parse(payload);
    const angle = Number(data.angle ?? slider.value);

    setAngle(angle);
    statusAngle.textContent = `${angle}\u00b0`;
    statusWifi.textContent = data.wifi || "-";
    statusIp.textContent = currentTopic;
    settingsHint.textContent = "Status ESP32 diterima dari MQTT.";
  } catch (error) {
    settingsHint.textContent = "Status MQTT tidak bisa dibaca.";
  }
}

function connectMqtt() {
  if (mqttClient) {
    mqttClient.end(true);
  }

  setConnectionState(false, "Connecting...");
  statusIp.textContent = currentTopic;

  mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    clientId: getClientId("servo-web"),
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 2500
  });

  mqttClient.on("connect", () => {
    setConnectionState(true, "MQTT Online");
    settingsHint.textContent = `Terhubung ke topic ${currentTopic}.`;
    mqttClient.subscribe(getStatusTopic());
    publish(getCommandTopic(), "status");
  });

  mqttClient.on("message", (topic, message) => {
    if (topic === getStatusTopic()) {
      handleStatusMessage(message.toString());
    }
  });

  mqttClient.on("reconnect", () => {
    setConnectionState(false, "Reconnecting...");
  });

  mqttClient.on("close", () => {
    setConnectionState(false, "Offline");
  });

  mqttClient.on("error", () => {
    setConnectionState(false, "Offline");
    settingsHint.textContent = "Tidak bisa terhubung ke MQTT broker.";
  });
}

slider.addEventListener("input", () => {
  const angle = Number(slider.value);
  setAngle(angle);
  publishAngleDebounced(angle);
});

document.querySelectorAll("[data-angle]").forEach((button) => {
  button.addEventListener("click", () => {
    const angle = Number(button.dataset.angle);
    setAngle(angle);
    publishAngleDebounced(angle);
  });
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextTopic = mqttTopicInput.value.trim().replace(/^\/+|\/+$/g, "");

  if (!nextTopic) {
    settingsHint.textContent = "Masukkan MQTT topic.";
    return;
  }

  currentTopic = nextTopic;
  localStorage.setItem(STORAGE_KEY_TOPIC, currentTopic);
  connectMqtt();
});

refreshButton.addEventListener("click", () => {
  publish(getCommandTopic(), "status");
});

mqttTopicInput.value = currentTopic;
setAngle(90);
connectMqtt();
