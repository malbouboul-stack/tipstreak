// Son de pièce + vibration quand un tip arrive. Les modules natifs (expo-audio, expo-haptics) sont
// chargés prudemment : une development build plus ancienne ne les contient pas, l'app reste alors muette.

/* eslint-disable @typescript-eslint/no-require-imports */
function load<T>(name: () => T): T | null {
  try {
    return name();
  } catch {
    return null;
  }
}

const audio = load(() => require('expo-audio') as typeof import('expo-audio'));
const haptics = load(() => require('expo-haptics') as typeof import('expo-haptics'));
const TIP_SOUND = require('../../assets/sounds/tip-success.wav');
/* eslint-enable @typescript-eslint/no-require-imports */

let audioModeSet = false;

export async function playTipSuccess() {
  try {
    haptics?.notificationAsync(haptics.NotificationFeedbackType.Success);
  } catch {}

  if (!audio) return;
  try {
    if (!audioModeSet) {
      // Se mélange à la musique en cours, sans la couper
      await audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
      audioModeSet = true;
    }
    const player = audio.createAudioPlayer(TIP_SOUND);
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        subscription.remove();
        player.remove();
      }
    });
    player.play();
  } catch (e) {
    console.warn('Son de confirmation indisponible', e);
  }
}
