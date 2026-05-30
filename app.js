const supportDot = document.querySelector("#support-dot");
const supportMessage = document.querySelector("#support-message");
const scanState = document.querySelector("#scan-state");
const scanTitle = document.querySelector("#scan-title");
const scanDetail = document.querySelector("#scan-detail");
const scanButton = document.querySelector("#scan-button");
const stopButton = document.querySelector("#stop-button");
const clearButton = document.querySelector("#clear-button");
const emptyState = document.querySelector("#empty-state");
const resultList = document.querySelector("#result-list");
const countBadge = document.querySelector("#count-badge");
const recordTemplate = document.querySelector("#record-template");

const SERIAL_NAME_STORAGE_KEY = "nfc-serial-name-map-v1";

let abortController = null;
let ndefReader = null;
let readCount = 0;

function setSupport(type, message) {
  supportDot.className = `dot ${type}`;
  supportMessage.textContent = message;
}

function setScanState(type, title, detail) {
  scanState.className = `scan-state ${type}`;
  scanTitle.textContent = title;
  scanDetail.textContent = detail;
}

function updateCount() {
  countBadge.textContent = `${readCount}개`;
  emptyState.hidden = readCount > 0;
}

function loadSerialNameMap() {
  try {
    return JSON.parse(localStorage.getItem(SERIAL_NAME_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSerialNameMap(serialNameMap) {
  localStorage.setItem(SERIAL_NAME_STORAGE_KEY, JSON.stringify(serialNameMap));
}

function getAssignedName(serialNumber) {
  if (!serialNumber) return "";

  const serialNameMap = loadSerialNameMap();
  const savedName = serialNameMap[serialNumber];

  if (savedName) return savedName;

  const typedName = prompt(
    `처음 감지한 NFC 태그입니다.\n\n시리얼 번호: ${serialNumber}\n\n이 태그의 이름을 입력하세요.`
  );
  const name = (typedName || "").trim();

  if (!name) return "";

  serialNameMap[serialNumber] = name;
  saveSerialNameMap(serialNameMap);

  return name;
}

function decodeRecordData(record) {
  if (!record.data) return "";

  if (record.recordType === "text") {
    return new TextDecoder(record.encoding || "utf-8").decode(record.data);
  }

  if (record.recordType === "url" || record.recordType === "absolute-url") {
    return new TextDecoder().decode(record.data);
  }

  if (record.recordType === "mime") {
    const mediaType = record.mediaType || "unknown";

    if (mediaType.includes("json") || mediaType.startsWith("text/")) {
      return new TextDecoder().decode(record.data);
    }

    return `${mediaType}, ${record.data.byteLength} bytes`;
  }

  if (record.recordType === "smart-poster" || record.recordType.includes(":")) {
    try {
      return record
        .toRecords()
        .map((innerRecord) => `${innerRecord.recordType}: ${decodeRecordData(innerRecord)}`)
        .join("\n");
    } catch {
      return `${record.data.byteLength} bytes`;
    }
  }
}