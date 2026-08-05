const DEFAULT_IP = "192.168.1.100";
const STORAGE_KEY = "esp32";

const slider = document.getElementById("servoSlider");
const angleReadout = document.getElementById("angleReadout");
const connectionPill = document.getElementById("connectionPill");
const connectionText = document.getElementById("connectionText");
const statusAngle = document.getElementById("statusAngle");
const statusWifi = document.getElementById("statusWifi");
const statusIp = document.getElementById("statusIp");
const settingsForm = document.getElementById("settingsForm");
const espIpInput = document.getElementById("espIp");
const settingsHint = document.getElementById("settingsHint");
const refreshButton = document.getElementById("refreshButton");

let requestTimer;

function getEspIp() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_IP;
}

function getBaseUrl() {
  return `http://${getEspIp()}`;
}

function setConnectionState(isOnline, label) {
  connectionPill.classList.toggle("online", isOnline);
  connectionPill.classList.toggle("offline", !isOnline);
  connectionText.textContent = label;
}

function setAngle(value) {
  const angle = Math.max(0, Math.min(180, Number(value)));
  slider.value = String(angle);
  angleReadout.textContent = `${angle}°`;
}

async function postServoAngle(angle) {
  const response = await fetch(`${getBaseUrl()}/servo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ angle })
  });

  if (!response.ok) {
    throw new Error(`ESP32 returned ${response.status}`);
  }
}

async function sendAngleDebounced(angle) {
  window.clearTimeout(requestTimer);
  requestTimer = window.setTimeout(async () => {
    try {
      await postServoAngle(angle);
      setConnectionState(true, "Online");
      statusAngle.textContent = `${angle}°`;
    } catch (error) {
      setConnectionState(false, "Offline");
      settingsHint.textContent = `Tidak bisa mengirim ke ${getEspIp()}.`;
    }
  }, 120);
}

async function refreshStatus() {
  try {
    const response = await fetch(`${getBaseUrl()}/status`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`ESP32 returned ${response.status}`);
    }

    const data = await response.json();
    const angle = Number(data.angle ?? slider.value);

    setAngle(angle);
    statusAngle.textContent = `${angle}°`;
    statusWifi.textContent = data.wifi || "-";
    statusIp.textContent = data.ip || getEspIp();
    setConnectionState(true, "Online");
    settingsHint.textContent = `Terhubung ke ${getEspIp()}.`;
  } catch (error) {
    statusWifi.textContent = "-";
    statusIp.textContent = getEspIp();
    setConnectionState(false, "Offline");
    settingsHint.textContent = `Pastikan ESP32 aktif di ${getEspIp()}.`;
  }
}

slider.addEventListener("input", () => {
  const angle = Number(slider.value);
  setAngle(angle);
  sendAngleDebounced(angle);
});

document.querySelectorAll("[data-angle]").forEach((button) => {
  button.addEventListener("click", () => {
    const angle = Number(button.dataset.angle);
    setAngle(angle);
    sendAngleDebounced(angle);
  });
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextIp = espIpInput.value.trim();

  if (!nextIp) {
    settingsHint.textContent = "Masukkan alamat IP ESP32.";
    return;
  }

  localStorage.setItem(STORAGE_KEY, nextIp);
  settingsHint.textContent = `Alamat ${nextIp} disimpan.`;
  refreshStatus();
});

refreshButton.addEventListener("click", refreshStatus);

espIpInput.value = getEspIp();
setAngle(90);
refreshStatus();
window.setInterval(refreshStatus, 5000);
