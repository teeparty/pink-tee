import { PronunciationOverride } from './types';

export function playChime() {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
  oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 1); // A4
  
  gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 1);
}

export function playVoice(text: string, overrides: PronunciationOverride[] = []) {
  if (!('speechSynthesis' in window)) return;
  
  let processedText = text;
  for (const override of overrides) {
     if (!override.original || !override.replacement) continue;
     const regex = new RegExp(`\\b${override.original}\\b`, 'gi');
     processedText = processedText.replace(regex, override.replacement);
  }
  
  const utterance = new SpeechSynthesisUtterance(processedText);
  utterance.pitch = 1;
  utterance.rate = 0.9;
  
  // Try to find a good voice
  const voices = window.speechSynthesis.getVoices();
  const goodVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Google'));
  if (goodVoice) {
    utterance.voice = goodVoice;
  }
  
  window.speechSynthesis.speak(utterance);
}

