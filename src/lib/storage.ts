// Petit stockage clé / valeur persistant (expo-sqlite/kv-store), synchrone : lisible dès le premier rendu.
// expo-sqlite est un module natif : une development build antérieure à son installation ne le contient pas.
// On le charge donc prudemment ; sans lui, l'app fonctionne, seulement sans mémoriser ses réglages.

type KeyValueStore = {
  getItemSync(key: string): string | null;
  setItemSync(key: string, value: string): void;
  removeItemSync(key: string): void;
};

function loadStore(): KeyValueStore | null {
  try {
    // require() et non import : un import qui échoue ferait planter tout le bundle
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-sqlite/kv-store').default as KeyValueStore;
  } catch {
    return null;
  }
}

const store = loadStore();

export function getItem(key: string): string | null {
  try {
    return store?.getItemSync(key) ?? null;
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string | null) {
  try {
    if (value === null) store?.removeItemSync(key);
    else store?.setItemSync(key, value);
  } catch {}
}
