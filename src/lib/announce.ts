// Voice, notifications and a chime. Every API here is optional: the app works without them.

let voiceEnabled = true;
const queue: string[] = [];
let speaking = false;

export function setVoiceEnabled(on: boolean) {
  voiceEnabled = on;
  if (!on) {
    queue.length = 0;
    window.speechSynthesis?.cancel();
    speaking = false;
  }
}

function dutchVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return voices.find((v) => v.lang.toLowerCase().startsWith('nl')) ?? null;
}

function speakNext() {
  const text = queue.shift();
  if (!text) {
    speaking = false;
    return;
  }
  speaking = true;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'nl-NL';
  const v = dutchVoice();
  if (v) u.voice = v;
  u.rate = 1.05;
  u.onend = speakNext;
  u.onerror = speakNext;
  window.speechSynthesis.speak(u);
}

export function speak(text: string) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  queue.push(text);
  // Keep the queue short: at demo speed stale messages are worse than skipped ones.
  while (queue.length > 2) queue.shift();
  if (!speaking) speakNext();
}

export async function requestNotifications() {
  try {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  } catch {
    /* not supported */
  }
}

export function notify(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  } catch {
    /* not supported */
  }
}

let audio: AudioContext | null = null;
export function chime(kind: 'step' | 'alert' | 'done' = 'step') {
  try {
    audio ??= new AudioContext();
    const notes = kind === 'alert' ? [880, 660, 880] : kind === 'done' ? [523, 659, 784, 1047] : [660, 880];
    notes.forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = audio!.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain).connect(audio!.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    /* audio not available */
  }
}
