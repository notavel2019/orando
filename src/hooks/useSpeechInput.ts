import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl, isStandaloneOfflineOrigin } from "../utils/appUpdate";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface AndroidSpeechBridge {
  isAvailable?: () => boolean;
  startSpeech: (language: string, prompt: string) => void;
}

declare global {
  interface Window {
    OratorioAndroidSpeech?: AndroidSpeechBridge;
    __oratorioSpeechCallback?: (text: string | null, error: string | null) => void;
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function hasAndroidNativeSpeech(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.OratorioAndroidSpeech?.startSpeech === "function"
  );
}

function hasMediaRecorderSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Falha ao ler áudio gravado."));
    reader.readAsDataURL(blob);
  });
}

export function useSpeechInput<TField extends string>(
  onTranscript: (field: TField, text: string) => void
) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [activeField, setActiveField] = useState<TField | null>(null);
  const [interimText, setInterimText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeFieldRef = useRef<TField | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const callbackRef = useRef(onTranscript);

  useEffect(() => {
    callbackRef.current = onTranscript;
  }, [onTranscript]);

  const cleanupMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimText("");
  }, []);

  useEffect(() => {
    const supported =
      hasAndroidNativeSpeech() ||
      Boolean(getSpeechRecognitionCtor()) ||
      (hasMediaRecorderSupport() && !isStandaloneOfflineOrigin());
    setIsSupported(supported);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupMediaStream();
      if (typeof window !== "undefined") {
        delete window.__oratorioSpeechCallback;
      }
    };
  }, [cleanupMediaStream]);

  const startMediaRecorderFallback = useCallback(
    async (field: TField) => {
      if (!hasMediaRecorderSupport() || isStandaloneOfflineOrigin()) {
        setErrorMessage(
          "O reconhecimento de voz não está disponível neste aparelho. Você também pode usar o microfone do teclado do celular."
        );
        setIsListening(false);
        setActiveField(null);
        activeFieldRef.current = null;
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : "";

        const recorder = preferredMime
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = async () => {
          cleanupMediaStream();
          mediaRecorderRef.current = null;
          setIsListening(false);

          const chunks = audioChunksRef.current;
          audioChunksRef.current = [];
          if (chunks.length === 0) {
            setActiveField(null);
            activeFieldRef.current = null;
            return;
          }

          const mimeType = recorder.mimeType || preferredMime || "audio/webm";
          const blob = new Blob(chunks, { type: mimeType });
          setIsTranscribing(true);
          setErrorMessage(null);

          try {
            const audioBase64 = await blobToBase64(blob);
            const res = await fetch(apiUrl("/api/prayer/transcribe"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioBase64, mimeType }),
            });
            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
              throw new Error(
                "Transcrição de áudio requer conexão com o servidor ou reconhecimento de voz nativo do Android."
              );
            }
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data?.error || "Não foi possível transcrever o áudio.");
            }
            const text = typeof data?.text === "string" ? data.text.trim() : "";
            if (text) {
              callbackRef.current(field, text);
            } else {
              setErrorMessage("Não foi possível identificar fala no áudio. Tente falar mais perto do microfone.");
            }
          } catch (err) {
            setErrorMessage(
              err instanceof Error ? err.message : "Erro ao transcrever sua fala."
            );
          } finally {
            setIsTranscribing(false);
            setActiveField(null);
            activeFieldRef.current = null;
          }
        };

        recorder.start();
        setActiveField(field);
        activeFieldRef.current = field;
        setIsListening(true);
        setErrorMessage(null);
      } catch {
        cleanupMediaStream();
        setIsListening(false);
        setActiveField(null);
        activeFieldRef.current = null;
        setErrorMessage(
          "Permissão de microfone negada. Libere o microfone nas configurações do navegador ou do aparelho."
        );
      }
    },
    [cleanupMediaStream]
  );

  const toggleField = useCallback(
    (field: TField, promptLabel = "Fale o que está no seu coração...") => {
      setErrorMessage(null);

      // If currently listening to the same field, stop cleanly
      if (isListening && activeFieldRef.current === field) {
        stop();
        if (!mediaRecorderRef.current) {
          setActiveField(null);
          activeFieldRef.current = null;
        }
        return;
      }

      // Stop any other active session before starting the new field
      if (isListening) {
        stop();
      }

      setActiveField(field);
      activeFieldRef.current = field;

      // TIER 1: Native Android Speech-to-Text Bridge (inside compiled APK)
      if (hasAndroidNativeSpeech()) {
        setIsListening(true);
        window.__oratorioSpeechCallback = (text, err) => {
          setIsListening(false);
          setInterimText("");
          const target = activeFieldRef.current ?? field;
          setActiveField(null);
          activeFieldRef.current = null;

          if (text && text.trim()) {
            callbackRef.current(target, text.trim());
            return;
          }
          if (err === "unavailable") {
            setErrorMessage(
              "Serviço de voz do Google não encontrado no aparelho. Instale/ative o app Google ou use o microfone do teclado."
            );
          } else if (err && err !== "cancelled") {
            setErrorMessage(
              "Não foi possível captar sua voz agora. Tente novamente ou use o microfone do teclado."
            );
          }
        };

        try {
          window.OratorioAndroidSpeech?.startSpeech("pt-BR", promptLabel);
        } catch {
          setIsListening(false);
          setActiveField(null);
          activeFieldRef.current = null;
          setErrorMessage("Não foi possível abrir o reconhecimento de voz do Android.");
        }
        return;
      }

      // TIER 2: Browser Web Speech API (invoked synchronously inside click gesture)
      const Ctor = getSpeechRecognitionCtor();
      if (Ctor) {
        const recognition = new Ctor();
        recognition.lang = "pt-BR";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let finalText = "";
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0]?.transcript?.trim() ?? "";
            if (!transcript) continue;
            if (result.isFinal) {
              finalText += (finalText ? " " : "") + transcript;
            } else {
              interim += (interim ? " " : "") + transcript;
            }
          }
          setInterimText(interim);
          if (finalText) {
            const target = activeFieldRef.current ?? field;
            callbackRef.current(target, finalText);
          }
        };

        recognition.onerror = (event) => {
          const code = event?.error || "";
          recognitionRef.current = null;
          setIsListening(false);
          setInterimText("");

          // Fall back to MediaRecorder + Gemini transcribe if Web Speech service is unavailable
          if (
            (code === "network" || code === "service-not-allowed" || code === "audio-capture") &&
            hasMediaRecorderSupport() &&
            !isStandaloneOfflineOrigin()
          ) {
            void startMediaRecorderFallback(field);
            return;
          }

          setActiveField(null);
          activeFieldRef.current = null;

          if (code === "not-allowed") {
            setErrorMessage(
              "Permissão de microfone bloqueada. Permita o uso do microfone no navegador para falar sua oração."
            );
          } else if (code === "no-speech") {
            setErrorMessage("Nenhuma fala detectada. Toque novamente e fale perto do microfone.");
          } else if (code && code !== "aborted") {
            setErrorMessage(
              "Não foi possível usar o ditado por voz agora. Tente novamente ou use o microfone do teclado."
            );
          }
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          setIsListening(false);
          setInterimText("");
          setActiveField(null);
          activeFieldRef.current = null;
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
          setIsListening(true);
          return;
        } catch {
          recognitionRef.current = null;
        }
      }

      // TIER 3: MediaRecorder + Gemini server-side audio transcription fallback
      void startMediaRecorderFallback(field);
    },
    [isListening, startMediaRecorderFallback, stop]
  );

  return {
    isSupported,
    isListening,
    isTranscribing,
    activeField,
    interimText,
    errorMessage,
    clearError: () => setErrorMessage(null),
    toggleField,
    stop,
  };
}
