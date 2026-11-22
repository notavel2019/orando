import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = "gemini-3.1-flash-lite";

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function sanitizeText(value: unknown, maxLen = 1500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const rawMessage = error instanceof Error ? error.message : String(error);
  if (rawMessage === "GEMINI_API_KEY_MISSING") {
    return {
      status: 500,
      message:
        "A chave da API não está configurada no servidor. Verifique a configuração em Settings > Secrets.",
    };
  }
  if (rawMessage.includes("403") || rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message:
        "Não foi possível autenticar com o serviço de reflexão. Verifique a chave da API em Settings > Secrets.",
    };
  }
  if (rawMessage.includes("429") || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message:
        "Muitas solicitações no momento. Aguarde alguns instantes e tente novamente.",
    };
  }
  return {
    status: 500,
    message:
      "Não foi possível concluir a geração agora. Tente novamente em alguns segundos.",
  };
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes("503") ||
        msg.includes("500") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("fetch failed");
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
    }
  }
  throw lastError;
}

const GITHUB_SEGMENT_RE = /^[A-Za-z0-9_.-]{1,100}$/;

function parseGitHubRepoServer(raw: unknown): { owner: string; repo: string } | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 300) return null;

  if (!trimmed.includes("://") && !trimmed.startsWith("github.com")) {
    const cleaned = trimmed.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    const parts = cleaned.split("/");
    if (
      parts.length === 2 &&
      GITHUB_SEGMENT_RE.test(parts[0]) &&
      GITHUB_SEGMENT_RE.test(parts[1])
    ) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  }

  const withScheme = trimmed.startsWith("github.com") ? `https://${trimmed}` : trimmed;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const segments = parsed.pathname
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  if (!GITHUB_SEGMENT_RE.test(owner) || !GITHUB_SEGMENT_RE.test(repo)) return null;
  return { owner, repo };
}

function isSafeGitHubDownloadUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "github.com" ||
      host === "objects.githubusercontent.com" ||
      host === "release-assets.githubusercontent.com" ||
      host.endsWith(".githubusercontent.com")
    );
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  // Allow Capacitor Android WebView origins to reach API endpoints when packaged as APK
  const allowedCapacitorOrigins = new Set([
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
  ]);
  app.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedCapacitorOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Check latest GitHub Release for APK updates (strictly pinned to api.github.com)
  app.post("/api/update/check", async (req, res) => {
    try {
      const parsed = parseGitHubRepoServer(req.body?.repoUrl);
      if (!parsed) {
        res.status(400).json({
          error:
            "Informe um link válido do GitHub (ex.: https://github.com/usuario/repositorio).",
        });
        return;
      }

      const apiEndpoint = `https://api.github.com/repos/${encodeURIComponent(
        parsed.owner
      )}/${encodeURIComponent(parsed.repo)}/releases/latest`;

      const ghRes = await fetch(apiEndpoint, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Oratorio-App-Updater",
        },
      });

      if (ghRes.status === 404) {
        res.status(404).json({
          error:
            "Nenhuma release encontrada neste repositório. Suba o projeto para o GitHub e aguarde a Action concluir a compilação do APK.",
        });
        return;
      }
      if (ghRes.status === 403) {
        res.status(429).json({
          error:
            "Limite temporário de consultas à API do GitHub atingido. Aguarde alguns minutos e tente novamente.",
        });
        return;
      }
      if (!ghRes.ok) {
        res.status(502).json({
          error: "Não foi possível consultar as releases no GitHub neste momento.",
        });
        return;
      }

      const release = (await ghRes.json()) as {
        tag_name?: string;
        name?: string;
        published_at?: string;
        body?: string;
        html_url?: string;
        assets?: Array<{
          name?: string;
          size?: number;
          browser_download_url?: string;
        }>;
      };

      const assets = Array.isArray(release.assets) ? release.assets : [];
      const apkAssets = assets.filter(
        (a) =>
          typeof a?.name === "string" &&
          a.name.toLowerCase().endsWith(".apk") &&
          isSafeGitHubDownloadUrl(a.browser_download_url)
      );

      const chosenApk =
        apkAssets.find((a) => a.name?.toLowerCase().includes("release")) ??
        apkAssets[0] ??
        null;

      const versionAsset = assets.find(
        (a) =>
          a?.name === "version.json" && isSafeGitHubDownloadUrl(a.browser_download_url)
      );

      let manifestVersionCode: number | null = null;
      let manifestSigned: boolean | null = null;

      if (versionAsset?.browser_download_url) {
        try {
          const manifestRes = await fetch(versionAsset.browser_download_url, {
            headers: { "User-Agent": "Oratorio-App-Updater" },
          });
          if (manifestRes.ok) {
            const manifest = (await manifestRes.json()) as {
              versionCode?: unknown;
              signedRelease?: unknown;
            };
            if (typeof manifest.versionCode === "number" && Number.isFinite(manifest.versionCode)) {
              manifestVersionCode = manifest.versionCode;
            }
            if (typeof manifest.signedRelease === "boolean") {
              manifestSigned = manifest.signedRelease;
            }
          }
        } catch {
          // Non-fatal: fall back to parsing release metadata
        }
      }

      const tagName = String(release.tag_name || "");
      const versionName = tagName.replace(/^v/i, "") || "0.0.0";
      const releaseName = String(release.name || tagName || "Última versão");
      const bodyText = String(release.body || "").slice(0, 2000);

      if (manifestVersionCode === null) {
        const buildMatch =
          releaseName.match(/Build\s+(\d+)/i) ||
          bodyText.match(/versionCode[^0-9]*(\d+)/i);
        if (buildMatch) {
          manifestVersionCode = Number.parseInt(buildMatch[1], 10);
        }
      }

      const isSignedRelease =
        manifestSigned !== null
          ? manifestSigned
          : Boolean(
              chosenApk?.name?.toLowerCase().includes("release") &&
                !chosenApk?.name?.toLowerCase().includes("debug")
            );

      res.json({
        repoFullName: `${parsed.owner}/${parsed.repo}`,
        tagName,
        versionName,
        versionCode: manifestVersionCode,
        releaseName,
        publishedAt: String(release.published_at || ""),
        releaseNotes: bodyText,
        releaseUrl: isSafeGitHubDownloadUrl(release.html_url)
          ? String(release.html_url)
          : `https://github.com/${parsed.owner}/${parsed.repo}/releases/latest`,
        apkAsset: chosenApk
          ? {
              name: String(chosenApk.name),
              sizeBytes: Number(chosenApk.size) || 0,
              downloadUrl: String(chosenApk.browser_download_url),
              isSignedRelease,
            }
          : null,
        signedRelease: isSignedRelease,
      });
    } catch {
      res.status(500).json({
        error: "Erro ao verificar atualização no GitHub. Tente novamente.",
      });
    }
  });

  // Server-side audio transcription using gemini-3.5-transcribe (fallback for browsers without Web Speech API)
  const ALLOWED_AUDIO_MIME = new Set([
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/aac",
    "audio/x-m4a",
  ]);

  app.post(
    "/api/prayer/transcribe",
    express.json({ limit: "8mb" }),
    async (req, res) => {
      try {
        const rawBase64 = typeof req.body?.audioBase64 === "string" ? req.body.audioBase64.trim() : "";
        const rawMime = typeof req.body?.mimeType === "string" ? req.body.mimeType.split(";")[0].trim().toLowerCase() : "";

        if (!rawBase64 || rawBase64.length > 6_500_000 || !/^[A-Za-z0-9+/=]+$/.test(rawBase64)) {
          res.status(400).json({ error: "Áudio inválido ou muito longo. Tente uma gravação mais curta." });
          return;
        }
        const safeMime = ALLOWED_AUDIO_MIME.has(rawMime) ? rawMime : "audio/webm";

        const ai = getAiClient();
        const response = await generateWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-3.5-transcribe",
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: safeMime,
                    data: rawBase64,
                  },
                },
                {
                  text: "Transcreva fielmente em português do Brasil o que foi falado neste áudio. Retorne apenas o texto transcrito, sem comentários ou formatação extra.",
                },
              ],
            },
          })
        );

        const text = (response.text ?? "").trim();
        res.json({ text });
      } catch (error) {
        const mapped = mapGeminiError(error);
        res.status(mapped.status).json({ error: mapped.message });
      }
    }
  );

  // Step 1 -> Step 2: Generate 3 tailored pastoral reflection questions
  app.post("/api/prayer/questions", async (req, res) => {
    try {
      const feelings = sanitizeText(req.body?.feelings, 800);
      const desires = sanitizeText(req.body?.desires, 800);
      const fears = sanitizeText(req.body?.fears, 800);
      const courage = sanitizeText(req.body?.courage, 800);
      const freeText = sanitizeText(req.body?.freeText, 1800);
      const themeContext = sanitizeText(req.body?.themeContext, 400);

      const combined = [feelings, desires, fears, courage, freeText].filter(Boolean).join(" ");
      if (combined.length < 3) {
        res.status(400).json({
          error: "Compartilhe ao menos um sentimento, desejo, medo ou reflexão para começarmos.",
        });
        return;
      }

      const ai = getAiClient();

      const userSummary = [
        themeContext ? `Tema bíblico de referência: ${themeContext}` : "",
        feelings ? `Sentimentos atuais: ${feelings}` : "",
        desires ? `Desejos e pretensões: ${desires}` : "",
        fears ? `Medos e temores: ${fears}` : "",
        courage ? `Onde deseja ou precisa de coragem: ${courage}` : "",
        freeText ? `Relato livre do coração: ${freeText}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `O cristão compartilhou o seguinte antes de orar:\n\n${userSummary}\n\nElabore uma frase breve de acolhimento e 3 perguntas reflexivas que o ajudem a aprofundar a sinceridade diante de Deus e alinhar seu coração aos propósitos bíblicos.`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            systemInstruction:
              "Você é um conselheiro espiritual cristão sábio, humilde, bíblico e acolhedor, falando em português do Brasil. Seu papel NÃO é substituir a oração da pessoa, mas ajudá-la a clarear o coração e aprender a orar com verdade. Faça perguntas curtas (1 frase), humanas, sem jargões religiosos artificiais, sem julgamento e diretamente conectadas ao que a pessoa escreveu. As 3 perguntas devem cobrir: (1) nomear com verdade o que pesa ou alegra o coração, (2) entregar temores ou desejos à sabedoria de Deus, e (3) discernir um passo de fé, obediência ou coragem alinhado ao Evangelho.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                acknowledgment: {
                  type: Type.STRING,
                  description: "Uma frase curta e empática acolhendo o que o usuário compartilhou (máximo 25 palavras).",
                },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      focus: {
                        type: Type.STRING,
                        description: "Rótulo breve de 2 a 3 palavras sobre o foco da pergunta (ex: Sinceridade, Entrega, Coragem).",
                      },
                      question: {
                        type: Type.STRING,
                        description: "Pergunta pastoral direta e específica ao que o usuário escreveu.",
                      },
                      hint: {
                        type: Type.STRING,
                        description: "Sugestão bem curta (até 12 palavras) para ajudar a refletir.",
                      },
                    },
                    required: ["id", "focus", "question", "hint"],
                  },
                },
              },
              required: ["acknowledgment", "questions"],
            },
          },
        })
      );

      const raw = (response.text ?? "").trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Step 2 -> Step 3: Compose the genuine, summarized, God-aligned prayer + teaching margin notes
  app.post("/api/prayer/compose", async (req, res) => {
    try {
      const heart = req.body?.heart ?? {};
      const feelings = sanitizeText(heart.feelings, 800);
      const desires = sanitizeText(heart.desires, 800);
      const fears = sanitizeText(heart.fears, 800);
      const courage = sanitizeText(heart.courage, 800);
      const freeText = sanitizeText(heart.freeText, 1800);
      const themeContext = sanitizeText(req.body?.themeContext, 400);

      const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const answers = rawAnswers
        .slice(0, 5)
        .map((item: { question?: unknown; answer?: unknown }) => ({
          question: sanitizeText(item?.question, 300),
          answer: sanitizeText(item?.answer, 800),
        }))
        .filter((item: { question: string; answer: string }) => item.question && item.answer);

      const combined = [feelings, desires, fears, courage, freeText].filter(Boolean).join(" ");
      if (combined.length < 3) {
        res.status(400).json({
          error: "Faltam informações do seu coração para montar a oração.",
        });
        return;
      }

      const ai = getAiClient();

      const promptParts = [
        "=== O QUE O CRISTÃO COMPARTILHOU ===",
        themeContext ? `Tema bíblico escolhido: ${themeContext}` : "",
        feelings ? `Sentimentos: ${feelings}` : "",
        desires ? `Desejos e pretensões: ${desires}` : "",
        fears ? `Medos e temores: ${fears}` : "",
        courage ? `Onde busca coragem: ${courage}` : "",
        freeText ? `Relato livre: ${freeText}` : "",
      ].filter(Boolean);

      if (answers.length > 0) {
        promptParts.push("\n=== RESPOSTAS ÀS PERGUNTAS REFLEXIVAS ===");
        answers.forEach((a: { question: string; answer: string }, idx: number) => {
          promptParts.push(`${idx + 1}. Pergunta: ${a.question}\n   Resposta: ${a.answer}`);
        });
      }

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `${promptParts.join("\n")}\n\nPrimeiro, organize um resumo claro e 100% fiel de tudo o que a pessoa digitou (sem inventar fatos). Em seguida, usando esse resumo organizado, monte uma oração completa, genuína e verdadeira que contemple cada situação e sentimento mencionado pela pessoa, alinhada aos propósitos de Deus, junto com notas breves que ensinem a estrutura dessa oração e um versículo bíblico adequado.`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            systemInstruction:
              "Você ajuda cristãos a fortalecerem sua vida de oração e aprenderem a orar, escrevendo em português do Brasil com máxima fidelidade ao que o usuário escreveu. Regras essenciais:\n1. NUNCA invente situações, nomes ou problemas que a pessoa não mencionou. Use fielmente cada ponto trazido por ela.\n2. Em 'organizedSummary', resuma de forma clara, organizada e respeitosa os principais pontos que a pessoa compartilhou (ex: Sentimentos, Desejos e Sonhos, Medos Entregues, Pedido de Coragem, Reflexões) — inclua apenas os tópicos que realmente tiverem conteúdo informado.\n3. Em 'prayerParagraphs', escreva uma oração completa, profunda e natural (4 parágrafos bem construídos) em primeira pessoa falando diretamente com Deus (Pai, Senhor), contemplando de forma organizada e fiel CADA situação, sentimento, desejo, medo, passo de coragem e resposta informada pelo usuário.\n4. Alinhe cada pedido e sonho à vontade soberana, à sabedoria e aos propósitos de Deus (como Jesus ensinou: 'seja feita a tua vontade').\n5. Inclua 3 notas curtas de aprendizado ('structureNotes') mostrando os pilares bíblicos usados na oração para ensinar o usuário a orar com autonomia.\n6. Escolha um versículo bíblico real e fiel às Escrituras (NVI ou ARA) que ancore a oração.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "Título curto e digno para a oração (4 a 8 palavras).",
                },
                organizedSummary: {
                  type: Type.ARRAY,
                  description: "Resumo organizado e fiel dos pontos que a pessoa digitou antes da oração.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: {
                        type: Type.STRING,
                        description: "Nome breve da dimensão (ex: Sentimentos, Desejos e sonhos, Temores entregues, Coragem).",
                      },
                      summary: {
                        type: Type.STRING,
                        description: "Síntese organizada e fiel do que a pessoa compartilhou nessa dimensão (1 frase).",
                      },
                    },
                    required: ["label", "summary"],
                  },
                },
                prayerParagraphs: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "4 parágrafos completos e fiéis da oração em primeira pessoa, terminando com Amém no último parágrafo.",
                },
                structureNotes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepLabel: {
                        type: Type.STRING,
                        description: "Nome curto do movimento de oração (ex: 01. Sinceridade, 02. Entrega, 03. Alinhamento).",
                      },
                      lesson: {
                        type: Type.STRING,
                        description: "Explicação prática de 1 a 2 frases ensinando por que esse passo fortalece a oração.",
                      },
                    },
                    required: ["stepLabel", "lesson"],
                  },
                },
                anchorVerse: {
                  type: Type.OBJECT,
                  properties: {
                    reference: { type: Type.STRING, description: "Referência bíblica (ex: Filipenses 4:6-7)." },
                    text: { type: Type.STRING, description: "Texto bíblico fiel em português." },
                    reflection: {
                      type: Type.STRING,
                      description: "Uma frase conectando o versículo ao momento do usuário.",
                    },
                  },
                  required: ["reference", "text", "reflection"],
                },
                faithStep: {
                  type: Type.STRING,
                  description: "Um passo simples e concreto de fé, obediência ou descanso para hoje (1 frase).",
                },
              },
              required: [
                "title",
                "organizedSummary",
                "prayerParagraphs",
                "structureNotes",
                "anchorVerse",
                "faithStep",
              ],
            },
          },
        })
      );

      const raw = (response.text ?? "").trim();
      const parsed = JSON.parse(raw);
      res.json({ ...parsed, modelUsed: MODEL_NAME });
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Optional custom biblical theme suggestion on demand
  app.post("/api/themes/suggest", async (req, res) => {
    try {
      const topic = sanitizeText(req.body?.topic, 200);
      if (topic.length < 2) {
        res.status(400).json({ error: "Informe um tema ou situação para buscar direção bíblica." });
        return;
      }

      const ai = getAiClient();
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Crie um breve guia devocional bíblico em português do Brasil sobre o tema: "${topic}".`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            systemInstruction:
              "Você prepara sugestões breves de temas bíblicos para guiar a oração de cristãos em português do Brasil. Use versículos reais e fiéis às Escrituras (ARA ou NVI), meditação clara e 3 passos práticos de oração (Reconhecer, Entregar, Pedir).",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  description: "Uma das categorias: Paz e Medo, Direção e Coragem, Gratidão, Família e Perdão, Propósito",
                },
                suggestedMinutes: { type: Type.INTEGER },
                verseReference: { type: Type.STRING },
                verseText: { type: Type.STRING },
                meditation: { type: Type.STRING },
                prayerDirections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      prompt: { type: Type.STRING },
                    },
                    required: ["label", "prompt"],
                  },
                },
              },
              required: [
                "title",
                "category",
                "suggestedMinutes",
                "verseReference",
                "verseText",
                "meditation",
                "prayerDirections",
              ],
            },
          },
        })
      );

      const raw = (response.text ?? "").trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      const indexFile = path.join(distPath, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Not found");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Oratório server listening on http://localhost:${PORT}`);
  });
}

startServer();
