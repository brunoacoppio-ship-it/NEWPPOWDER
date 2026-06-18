/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Windy Webcams API key (item 5.2). Optional — absent ⇒ webcam section hidden. */
  readonly VITE_WINDY_WEBCAMS_KEY?: string;
}
