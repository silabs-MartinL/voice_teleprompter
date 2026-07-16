const SCRIPT_TEXT = `Welcome to Voice TeleprompteR. This is the default demonstration script. It shows how the TeleprompteR follows your voice instead of scrolling at a fixed speed. Notice that the script only advances while you are speaking. You can pause at any time to think, look at your audience, or demonstrate something on screen without losing your place. Some words appear in cyan. These are optional words. They help the TeleprompteR cope with common filler words, technical terms, acronyms, product names, and unusual identifiers. White words are required. These are the words the recognizer uses to keep track of your position in the script. You can load your own script using the Open button, or edit the current script using the built in editor. The TeleprompteR automatically remembers the last script you used, so the next time you open it your work is restored automatically. For more information about the recognition system, colour coding, script statistics, and available voice commands, open the Help page from the toolbar. You are now ready to load your own script and start recording with Voice TeleprompteR.`;
let currentScript = localStorage.getItem('teleprompterScriptText') || SCRIPT_TEXT;

const filler = new Set(['a','an','and','are','as','at','be','but','by','for','from','i','in','is','it','of','on','or','so','that','the','to','we','were','when','while','with']);
const weak = new Set(['a','an','and','are','as','at','be','but','by','can','for','from','i','in','is','it','of','on','or','so','that','the','to','we','were','when','while','with']);
const aliases = new Map([
  ['rssi', ['rssi','r s s i','rss i','rc i','arssi']],
  ['likeliness', ['likeliness','likeness','likelihood','like liness','likelyness']],
  ['sounding', ['sounding','soundings']],
  ['measurements', ['measurements','measurement']],
  ['measurement', ['measurement','measurements']],
]);

const scriptEl = document.getElementById('script');
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const debugEl = document.getElementById('debug');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const openBtn = document.getElementById('openBtn');
const fileInput = document.getElementById('fileInput');
const editBtn = document.getElementById('editBtn');
const editorOverlay = document.getElementById('editorOverlay');
const scriptEditor = document.getElementById('scriptEditor');
const applyEditBtn = document.getElementById('applyEditBtn');
const downloadScriptBtn = document.getElementById('downloadScriptBtn');
const closeEditBtn = document.getElementById('closeEditBtn');
const fontDownBtn = document.getElementById('fontDownBtn');
const fontUpBtn = document.getElementById('fontUpBtn');
const mirrorBtn = document.getElementById('mirrorBtn');
const flipBtn = document.getElementById('flipBtn');
const eyeGapDownBtn = document.getElementById('eyeGapDownBtn');
const eyeGapUpBtn = document.getElementById('eyeGapUpBtn');
const toolbar = document.getElementById('toolbar');
const helpBtn = document.getElementById('helpBtn');
const helpOverlay = document.getElementById('helpOverlay');
const closeHelpBtn = document.getElementById('closeHelpBtn');
const wpmInput = document.getElementById('wpmInput');
const statWords = document.getElementById('statWords');
const statSentences = document.getElementById('statSentences');
const statOptional = document.getElementById('statOptional');
const statTime = document.getElementById('statTime');
const unsupported = document.getElementById('unsupported');

let words = [];
let sentenceEls = [];
let pointer = 0;
let recognition = null;
let listening = false;
let sentenceLockedUntilNextEvent = false;
let lastScrollAt = 0;
let toolbarHideTimer = null;
let readingWpm = parseInt(localStorage.getItem('teleprompterWpm') || '145', 10);
let mirrorEnabled = localStorage.getItem('teleprompterMirror') === '1';
let flipEnabled = localStorage.getItem('teleprompterFlip') === '1';
const EYE_CONTACT_GAP_STEP_PX = 48;
let eyeContactGapSteps = parseInt(localStorage.getItem('teleprompterEyeContactGapSteps') || '0', 10);
if (!Number.isFinite(eyeContactGapSteps)) eyeContactGapSteps = 4;
eyeContactGapSteps = Math.max(0, Math.min(12, eyeContactGapSteps));

function normalize(s) {
  return s.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\br\s*s\s*s\s*i\b/g, 'rssi')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordMatches(expected, transcriptTokens, transcriptNorm) {
  if (!expected) return false;
  const base = expected.norm;
  if (transcriptTokens.includes(base)) return true;
  const list = aliases.get(base);
  if (list) return list.some(a => transcriptNorm.includes(a));
  return false;
}

function wordMatchesNearStart(expected, transcriptTokens, transcriptNorm, maxIndex = 2) {
  if (!expected) return false;
  const base = expected.norm;
  const idx = transcriptTokens.indexOf(base);
  if (idx >= 0 && idx <= maxIndex) return true;
  const list = aliases.get(base);
  if (list) {
    return list.some(a => {
      const aliasNorm = normalize(a);
      if (!aliasNorm) return false;
      if (transcriptNorm.startsWith(aliasNorm)) return true;
      const aliasFirst = aliasNorm.split(' ')[0];
      const aliasIdx = transcriptTokens.indexOf(aliasFirst);
      return aliasIdx >= 0 && aliasIdx <= maxIndex;
    });
  }
  return false;
}

function isSentenceStartIndex(index) {
  return index <= 0 || words[index - 1]?.sentenceIndex !== words[index]?.sentenceIndex;
}

function splitSentences(text) {
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return matches.map(s => s.trim()).filter(Boolean);
}

function isOptionalWord(display) {
  const word = display.replace(/^[^\w]+|[^\w]+$/g, '');
  if (!word) return false;
  if (/^[A-Z]{2,}$/.test(word)) return true;
  if (/[A-Za-z]/.test(word) && /\d/.test(word)) return true;
  if (/[a-z][A-Z]/.test(word)) return true;
  return false;
}

function tokenizeSentence(sentence, sentenceIndex) {
  const parts = sentence.match(/\S+\s*/g) || [];
  const out = [];
  for (const rawPart of parts) {
    const raw = rawPart.trim();
    const m = raw.match(/^(.+?)([.,!?;:]*)$/);
    const display = m ? m[1] : raw;
    const punct = m ? m[2] : '';
    const norm = normalize(display);
    if (!norm) continue;
    out.push({ display, punct, norm, sentenceIndex, el: null, isFiller: filler.has(norm), isWeak: weak.has(norm) || norm.length <= 3, isOptional: isOptionalWord(display) });
  }
  return out;
}

function render() {
  scriptEl.innerHTML = '';
  words = [];
  sentenceEls = [];
  const eyeGapEl = document.createElement('span');
  eyeGapEl.id = 'eyeContactGap';
  eyeGapEl.className = 'eyeContactGap';
  splitSentences(currentScript).forEach((sentence, sentenceIndex) => {
    const sentEl = document.createElement('span');
    sentEl.className = 'sentence';
    sentenceEls.push(sentEl);
    const sentWords = tokenizeSentence(sentence, sentenceIndex);
    sentWords.forEach((w, i) => {
      const el = document.createElement('span');
      el.className = 'word' + ((w.isOptional || w.isFiller) ? ' optional' : '');
      el.textContent = w.display;
      const punct = document.createElement('span');
      punct.className = 'punct';
      punct.textContent = w.punct + (i === sentWords.length - 1 ? '' : ' ');
      sentEl.appendChild(el);
      sentEl.appendChild(punct);
      w.el = el;
      words.push(w);
    });
    scriptEl.appendChild(sentEl);
  });
  scriptEl.appendChild(eyeGapEl);
  updateEyeContactGap();
  updateDisplay(true);
  updateStats();
}

function nextStrongWordIndex(start, limit = 6) {
  const currentSentence = words[start]?.sentenceIndex;
  for (let i = start; i < Math.min(words.length, start + limit); i++) {
    if (words[i].sentenceIndex !== currentSentence) break;
    if (!words[i].isWeak && !words[i].isOptional) return i;
  }
  return start;
}

function expectedDebug() {
  if (pointer >= words.length) return 'Complete';
  const q = [];
  const sent = words[pointer].sentenceIndex;
  for (let i = pointer; i < words.length && q.length < 6; i++) {
    if (words[i].sentenceIndex !== sent) break;
    if (!words[i].isFiller || i === pointer) q.push(words[i].display);
  }
  return q.join(' / ');
}

function updateDisplay(forceScroll = false) {
  updateEyeContactGap();
  words.forEach((w, i) => {
    w.el.classList.toggle('read', i < pointer);
    w.el.classList.toggle('current', i === pointer);
    const punctEl = w.el.nextSibling;
    if (punctEl && punctEl.classList) {
      punctEl.classList.toggle('read', i < pointer);
    }
  });
  debugEl.textContent = 'Waiting for: ' + expectedDebug();
  if (forceScroll || Date.now() - lastScrollAt > 650) {
    scrollToPointer();
    lastScrollAt = Date.now();
  }
}

function scrollToPointer() {
  if (pointer >= words.length) return;
  const stageRect = stage.getBoundingClientRect();

  if (eyeContactGapSteps > 0) {
    const gap = document.getElementById('eyeContactGap');
    if (gap && gap.offsetHeight > 0) {
      const gapRect = gap.getBoundingClientRect();
      const gapTargetTop = Math.max(0, (stage.clientHeight - gap.offsetHeight) / 2);
      const targetTop = stage.scrollTop + (gapRect.top - stageRect.top) - gapTargetTop;
      stage.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      return;
    }
  }

  const el = words[pointer].el;
  const elRect = el.getBoundingClientRect();
  const targetTop = stage.scrollTop + (elRect.top - stageRect.top) - stage.clientHeight * 0.42;
  stage.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
}

function resetTeleprompter() {
  pointer = 0;
  sentenceLockedUntilNextEvent = false;
  updateDisplay(true);
  statusEl.textContent = listening ? 'Listening — reset to beginning' : 'Reset to beginning';
}

function advanceOne() {
  if (pointer < words.length) pointer++;
  updateDisplay();
}

function advanceToNextSentence() {
  if (pointer >= words.length) return;
  const s = words[pointer].sentenceIndex;
  while (pointer < words.length && words[pointer].sentenceIndex === s) pointer++;
  sentenceLockedUntilNextEvent = true;
  updateDisplay(true);
}

function backSentence() {
  if (pointer <= 0) { resetTeleprompter(); return; }
  const prevSentence = words[Math.max(0, pointer - 1)].sentenceIndex;
  while (pointer > 0 && words[pointer - 1].sentenceIndex === prevSentence) pointer--;
  sentenceLockedUntilNextEvent = false;
  updateDisplay(true);
}

function handleTranscript(transcript) {
  const norm = normalize(transcript);
  if (!norm) return;
  if (norm.includes('hey reset') || norm.includes('hay reset') || norm.includes('a reset')) {
    resetTeleprompter();
    return;
  }
  const tokens = norm.split(' ');
  statusEl.textContent = 'Heard: ' + transcript.slice(0, 90);

  if (sentenceLockedUntilNextEvent) {
    sentenceLockedUntilNextEvent = false;
    // Do not consume the same recognition event that triggered the unlock.
    statusEl.textContent = 'Sentence lock released';
    return;
  }

  let consumed = 0;
  const startSentence = words[pointer]?.sentenceIndex;
  while (pointer < words.length && consumed < 8) {
    const current = words[pointer];
    if (current.sentenceIndex !== startSentence) {
      sentenceLockedUntilNextEvent = true;
      break;
    }

    const atSentenceStart = isSentenceStartIndex(pointer);

    // At the start of a sentence, only accept words that appear right at the
    // beginning of the recognition result. This prevents the end of the
    // previous sentence from dragging us into the next one.
    if (atSentenceStart && consumed === 0) {
      if (wordMatchesNearStart(current, tokens, norm)) {
        pointer++;
        consumed++;
        continue;
      }
      if (current.isFiller || current.isOptional) {
        const strongIdx = nextStrongWordIndex(pointer + 1, 5);
        if (strongIdx > pointer && words[strongIdx] && wordMatchesNearStart(words[strongIdx], tokens, norm)) {
          pointer = strongIdx + 1;
          consumed++;
          continue;
        }
      }
      break;
    }

    // Auto-step over very common filler or optional words only when the next strong word was heard.
    if (current.isFiller || current.isOptional) {
      const strongIdx = nextStrongWordIndex(pointer + 1, 5);
      if (strongIdx > pointer && words[strongIdx] && wordMatches(words[strongIdx], tokens, norm)) {
        pointer = strongIdx + 1;
        consumed++;
        continue;
      }
    }

    if (wordMatches(current, tokens, norm)) {
      pointer++;
      consumed++;
      continue;
    }

    // If current is weak, allow exactly one next non-weak content word, but not across sentences.
    const next = words[pointer + 1];
    if (current.isWeak && next && next.sentenceIndex === current.sentenceIndex && !next.isWeak && !next.isOptional && wordMatches(next, tokens, norm)) {
      pointer += 2;
      consumed++;
      continue;
    }
    break;
  }

  if (pointer < words.length && startSentence !== undefined && words[pointer]?.sentenceIndex !== startSentence) {
    sentenceLockedUntilNextEvent = true;
  }
  updateDisplay(consumed > 0);
}


function getFontPx() {
  const v = localStorage.getItem('teleprompterFontPx');
  return v ? parseInt(v, 10) : null;
}

function applyFontPx(px) {
  if (!px) {
    scriptEl.style.removeProperty('--prompt-font-size');
    return;
  }
  px = Math.max(32, Math.min(100, px));
  scriptEl.style.setProperty('--prompt-font-size', px + 'px');
  localStorage.setItem('teleprompterFontPx', String(px));
  updateDisplay(true);
}

function currentFontPx() {
  const saved = getFontPx();
  if (saved) return saved;
  return Math.round(parseFloat(getComputedStyle(scriptEl).fontSize) || 60);
}

function changeFont(delta) {
  applyFontPx(currentFontPx() + delta);
}

function updateScriptTransform() {
  const transforms = [];

  if (mirrorEnabled) {
    transforms.push('scaleX(-1)');
  }

  if (flipEnabled) {
    transforms.push('rotate(180deg)');
  }

  scriptEl.style.transform = transforms.length ? transforms.join(' ') : 'none';
}

function applyMirror(enabled) {
  mirrorEnabled = !!enabled;
  localStorage.setItem('teleprompterMirror', mirrorEnabled ? '1' : '0');
  if (mirrorBtn) mirrorBtn.textContent = mirrorEnabled ? 'Unmirror' : 'Mirror';
  updateScriptTransform();
}

function applyFlip(enabled) {
  flipEnabled = !!enabled;

  localStorage.setItem('teleprompterFlip', flipEnabled ? '1' : '0');

  if (flipBtn) {
    flipBtn.textContent = flipEnabled ? 'Unflip' : 'Flip';
  }

  updateScriptTransform();

  // Reposition based on the current word, not the old scrollbar position.
  // This is more reliable when the script is flipped because the visual
  // direction of the scroll area changes.
  requestAnimationFrame(() => {
    updateDisplay(true);
  });
}

function toggleMirror() {
  applyMirror(!mirrorEnabled);
}

function toggleFlip() {
  applyFlip(!flipEnabled);
}


function applyEyeContactGap() {
  eyeContactGapSteps = Math.max(0, Math.min(12, eyeContactGapSteps));
  localStorage.setItem('teleprompterEyeContactGapSteps', String(eyeContactGapSteps));

  const gap = document.getElementById('eyeContactGap');
  if (gap) {
    gap.style.height = (eyeContactGapSteps * EYE_CONTACT_GAP_STEP_PX) + 'px';
    gap.style.display = eyeContactGapSteps > 0 ? 'block' : 'none';
  }

  if (eyeGapDownBtn) eyeGapDownBtn.disabled = eyeContactGapSteps <= 0;
  if (eyeGapUpBtn) eyeGapUpBtn.disabled = eyeContactGapSteps >= 12;

  updateEyeContactGap();
}

function changeEyeContactGap(delta) {
  eyeContactGapSteps = Math.max(0, Math.min(12, eyeContactGapSteps + delta));
  applyEyeContactGap();
  updateDisplay(true);
  statusEl.textContent = eyeContactGapSteps > 0 ? 'Eye contact gap: ' + eyeContactGapSteps + ' steps' : 'Eye contact gap hidden';
}

function updateEyeContactGap() {
  const gap = document.getElementById('eyeContactGap');
  if (!gap || !sentenceEls.length || !words.length) return;

  gap.style.height = (eyeContactGapSteps * EYE_CONTACT_GAP_STEP_PX) + 'px';
  gap.style.display = eyeContactGapSteps > 0 ? 'block' : 'none';

  if (eyeContactGapSteps <= 0 || pointer >= words.length) {
    if (gap.parentNode !== scriptEl) scriptEl.appendChild(gap);
    return;
  }

  // Move the gap after the next two rendered lines from the current word.
  // The browser decides line wrapping, so we measure the actual word positions
  // and place the gap after the last word on the second visible line. This
  // keeps long sentences readable in small windows without hiding text.
  if (gap.parentNode !== scriptEl || gap.nextSibling !== null) {
    scriptEl.appendChild(gap);
  }
  gap.style.display = 'none';

  const lineTops = [];
  let targetIndex = pointer;
  const tolerance = 3;

  for (let i = pointer; i < words.length; i++) {
    const rect = words[i].el.getBoundingClientRect();
    const top = rect.top;
    let lineIndex = lineTops.findIndex(v => Math.abs(v - top) <= tolerance);

    if (lineIndex === -1) {
      lineTops.push(top);
      lineIndex = lineTops.length - 1;
    }

    if (lineIndex >= 2) break;
    targetIndex = i;
  }

  gap.style.display = 'block';

  const targetWord = words[targetIndex];
  const punctEl = targetWord?.el?.nextSibling;
  const parent = targetWord?.el?.parentNode;

  if (parent && punctEl) {
    parent.insertBefore(gap, punctEl.nextSibling);
  } else {
    scriptEl.appendChild(gap);
  }
}

function showToolbar() {
  toolbar.classList.remove('toolbar-hidden');
  clearTimeout(toolbarHideTimer);
  toolbarHideTimer = setTimeout(() => {
    toolbar.classList.add('toolbar-hidden');
  }, 3000);
}

function loadScriptText(text) {
  const cleaned = (text || '').replace(/\r\n/g, '\n').trim();
  if (!cleaned) {
    statusEl.textContent = 'Selected file was empty';
    return;
  }
  currentScript = cleaned;
  localStorage.setItem('teleprompterScriptText', currentScript);
  pointer = 0;
  sentenceLockedUntilNextEvent = false;
  render();
  updateDisplay(true);
  statusEl.textContent = 'Loaded script from file';
}

function openScriptFile() {
  fileInput.value = '';
  fileInput.click();
}

function handleScriptFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadScriptText(String(reader.result || ''));
  reader.onerror = () => { statusEl.textContent = 'Could not read file'; };
  reader.readAsText(file);
}

function openEditor() {
  scriptEditor.value = currentScript;
  editorOverlay.style.display = 'block';
  toolbar.classList.add('toolbar-hidden');
  setTimeout(() => scriptEditor.focus(), 0);
}

function closeEditor() {
  editorOverlay.style.display = 'none';
  showToolbar();
}

function applyEditorText() {
  const cleaned = (scriptEditor.value || '').replace(/\r\n/g, '\n').trim();
  if (!cleaned) {
    statusEl.textContent = 'Editor is empty';
    return;
  }
  currentScript = cleaned;
  localStorage.setItem('teleprompterScriptText', currentScript);
  pointer = 0;
  sentenceLockedUntilNextEvent = false;
  render();
  updateDisplay(true);
  statusEl.textContent = 'Edited script applied';
  closeEditor();
}

function downloadCurrentScript() {
  const blob = new Blob([scriptEditor.value || currentScript], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'teleprompter_script.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  statusEl.textContent = 'Script downloaded';
}


function formatEstimatedTime(totalWords, wpm) {
  const safeWpm = Math.max(1, Number(wpm) || 145);
  const totalSeconds = Math.max(1, Math.round((totalWords / safeWpm) * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return seconds + 's';
  return minutes + 'm ' + String(seconds).padStart(2, '0') + 's';
}

function updateStats() {
  if (!statWords || !statSentences || !statOptional || !statTime) return;
  const totalWords = words.length;
  const totalSentences = splitSentences(currentScript).length;
  const optionalWords = words.filter(w => w.isOptional || w.isFiller).length;
  const wpm = Math.max(1, Number(readingWpm) || 145);
  statWords.textContent = totalWords;
  statSentences.textContent = totalSentences;
  statOptional.textContent = optionalWords;
  statTime.textContent = formatEstimatedTime(totalWords, wpm);
}

function saveHelpStats() {
  const totalWords = words.length;
  const totalSentences = splitSentences(currentScript).length;
  const optionalWords = words.filter(w => w.isOptional || w.isFiller).length;
  const wpm = Math.max(1, Number(readingWpm) || 145);
  localStorage.setItem('teleprompterStatWords', String(totalWords));
  localStorage.setItem('teleprompterStatSentences', String(totalSentences));
  localStorage.setItem('teleprompterStatOptional', String(optionalWords));
  localStorage.setItem('teleprompterStatTime', formatEstimatedTime(totalWords, wpm));
}

function openHelp() {
  saveHelpStats();
  localStorage.setItem('teleprompterWpm', String(readingWpm || 145));
  location.href = 'help.html';
}

function resetApplicationSettings() {

    if (!confirm(
        "This will delete the saved script, font size and reading speed.\n\nContinue?"
    )) {
        return;
    }

    localStorage.removeItem("teleprompterScriptText");
    localStorage.removeItem("teleprompterFontPx");
    localStorage.removeItem("teleprompterWpm");
    localStorage.removeItem("teleprompterMirror");
    localStorage.removeItem("teleprompterFlip");
    localStorage.removeItem("teleprompterEyeContact");
    localStorage.removeItem("teleprompterEyeContactGapSteps");
    localStorage.removeItem("teleprompterStatWords");
    localStorage.removeItem("teleprompterStatSentences");
    localStorage.removeItem("teleprompterStatOptional");
    localStorage.removeItem("teleprompterStatTime");

    location.reload();
}

function closeHelp() {
  location.href = 'index.html';
}

function handleWpmChange() {
  const value = Math.max(60, Math.min(300, parseInt(wpmInput.value || '145', 10)));
  readingWpm = value;
  wpmInput.value = String(value);
  localStorage.setItem('teleprompterWpm', String(value));
  updateStats();
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    unsupported.style.display = 'block';
    return;
  }
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    startBtn.textContent = 'Stop';
    statusEl.textContent = 'Listening';
  };
  recognition.onend = () => {
    if (listening) {
      try { recognition.start(); } catch (e) {}
    } else {
      startBtn.textContent = 'Start';
      statusEl.textContent = 'Stopped';
    }
  };
  recognition.onerror = e => { statusEl.textContent = 'Speech error: ' + e.error; };
  recognition.onresult = event => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const text = res[0].transcript;
      // Use interim results for responsiveness, finals for certainty. The pointer lock protects sentence edges.
      handleTranscript(text);
    }
  };
  try { recognition.start(); } catch (e) { statusEl.textContent = 'Could not start microphone'; }
}

if (helpBtn) helpBtn.addEventListener('click', openHelp);
if (closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
if (wpmInput) {
  wpmInput.addEventListener('change', handleWpmChange);
  wpmInput.addEventListener('input', () => {
    readingWpm = Math.max(1, parseInt(wpmInput.value || '145', 10));
    updateStats();
  });
}
openBtn.addEventListener('click', openScriptFile);
fileInput.addEventListener('change', handleScriptFileChange);
editBtn.addEventListener('click', openEditor);
applyEditBtn.addEventListener('click', applyEditorText);
downloadScriptBtn.addEventListener('click', downloadCurrentScript);
closeEditBtn.addEventListener('click', closeEditor);
editorOverlay.addEventListener('click', e => {
  if (e.target === editorOverlay) closeEditor();
});

startBtn.addEventListener('click', () => {
  if (listening) {
    listening = false;
    if (recognition) recognition.stop();
  } else {
    listening = true;
    startRecognition();
  }
});
resetBtn.addEventListener('click', resetTeleprompter);
fontDownBtn.addEventListener('click', () => changeFont(-4));
fontUpBtn.addEventListener('click', () => changeFont(4));
if (mirrorBtn) mirrorBtn.addEventListener('click', toggleMirror);
if (flipBtn) flipBtn.addEventListener('click', toggleFlip);
if (eyeGapDownBtn) eyeGapDownBtn.addEventListener('click', () => changeEyeContactGap(-1));
if (eyeGapUpBtn) eyeGapUpBtn.addEventListener('click', () => changeEyeContactGap(1));
document.addEventListener('mousemove', showToolbar);
toolbar.addEventListener('mouseenter', showToolbar);

const resetAppBtn = document.getElementById("resetAppBtn");

if (resetAppBtn) {
    resetAppBtn.addEventListener("click", resetApplicationSettings);
}

render();
applyMirror(mirrorEnabled);
applyFlip(flipEnabled);
applyEyeContactGap();
if (wpmInput) wpmInput.value = String(readingWpm || 145);
updateStats();
const savedFontPx = getFontPx();
if (savedFontPx) applyFontPx(savedFontPx);
showToolbar();
