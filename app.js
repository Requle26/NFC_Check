alert("app.js 실행됨");

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

  return `${record.data.byteLength} bytes`;
}

function addDefinition(list, term, description) {
  const item = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");

  dt.textContent = term;
  dd.textContent = description || "-";

  item.append(dt, dd);
  list.append(item);
}

function renderReading(event) {
  readCount += 1;
  updateCount();

  const clone = recordTemplate.content.cloneNode(true);
  const title = clone.querySelector(".record-title");
  const time = clone.querySelector(".record-time");
  const serial = clone.querySelector(".record-serial");
  const details = clone.querySelector(".record-list");
  const records = Array.from(event.message.records || []);

  title.textContent = `NFC 태그 #${readCount}`;
  time.textContent = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

  serial.textContent = event.serialNumber
    ? `Serial ${event.serialNumber}`
    : "Serial 없음";

  addDefinition(details, "records", `${records.length}개`);

  records.forEach((record, index) => {
    const label = record.mediaType
      ? `${index + 1}. ${record.recordType} / ${record.mediaType}`
      : `${index + 1}. ${record.recordType}`;

    addDefinition(details, label, decodeRecordData(record));
  });

  resultList.prepend(clone);
}

function stopScan() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }

  ndefReader = null;
  scanButton.disabled = false;
  stopButton.disabled = true;
  setScanState("idle", "대기 중", "스캔을 시작하면 감지 결과가 여기에 표시됩니다.");
}

async function startScan() {
  if (!window.isSecureContext) {
    setScanState("warning", "HTTPS 필요", "HTTPS 주소에서 열어야 NFC 권한을 받을 수 있습니다.");
    return;
  }

  if (!("NDEFReader" in window)) {
    setScanState("error", "지원 안 됨", "Android Chrome에서 열어주세요.");
    return;
  }

  abortController = new AbortController();
  scanButton.disabled = true;
  stopButton.disabled = false;
  setScanState("scanning", "스캔 중", "휴대폰 뒷면을 NFC 태그에 가까이 대세요.");

  try {
    ndefReader = new NDEFReader();

    ndefReader.addEventListener("reading", (event) => {
      renderReading(event);
      setScanState("success", "감지됨", "NFC 태그를 읽었습니다. 계속 대면 새 기록이 추가됩니다.");
    });

    ndefReader.addEventListener("readingerror", () => {
      setScanState("warning", "읽기 실패", "태그를 다시 가까이 대보세요.");
    });

    await ndefReader.scan({ signal: abortController.signal });
  } catch (error) {
    abortController = null;
    ndefReader = null;
    scanButton.disabled = false;
    stopButton.disabled = true;

    if (error.name === "AbortError") {
      setScanState("idle", "대기 중", "스캔이 중지되었습니다.");
      return;
    }

    const message =
      error.name === "NotAllowedError"
        ? "NFC 권한이 거부되었습니다."
        : error.message || "스캔을 시작할 수 없습니다.";

    setScanState("error", "오류", message);
  }
}

function checkSupport() {
  if (!window.isSecureContext) {
    setSupport("warn", "HTTPS 주소에서 NFC 권한을 사용할 수 있습니다.");
    setScanState("warning", "HTTPS 필요", "HTTPS로 배포한 뒤 Android Chrome에서 열어주세요.");
    return;
  }

  if (!("NDEFReader" in window)) {
    setSupport("fail", "이 브라우저는 Web NFC를 지원하지 않습니다.");
    scanButton.disabled = true;
    setScanState("error", "지원 안 됨", "Android Chrome에서 열어주세요.");
    return;
  }

  setSupport("ok", "Web NFC 사용 가능");
  setScanState("idle", "대기 중", "스캔을 시작하면 감지 결과가 여기에 표시됩니다.");
}

scanButton.addEventListener("click", startScan);
stopButton.addEventListener("click", stopScan);

clearButton.addEventListener("click", () => {
  readCount = 0;
  resultList.replaceChildren();
  updateCount();
});

updateCount();
checkSupport();