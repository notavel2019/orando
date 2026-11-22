import { DAILY_THEMES } from "../data/dailyThemes";
import type {
  AnchorVerse,
  ComposedPrayer,
  DailyBiblicalTheme,
  HeartInput,
  QuestionsResponse,
  ReflectiveQuestion,
} from "../types/prayer";

interface TopicProfile {
  keywords: string[];
  verse: AnchorVerse;
  extraQuestion: ReflectiveQuestion;
  faithStep: string;
}

const TOPIC_PROFILES: TopicProfile[] = [
  {
    keywords: ["medo", "temo", "ansied", "ansios", "preocup", "pânico", "angúst", "angust", "incert", "insegur"],
    verse: {
      reference: "Filipenses 4:6-7",
      text: "Não andem ansiosos por coisa alguma, mas em tudo, pela oração e súplicas, e com ação de graças, apresentem seus pedidos a Deus. E a paz de Deus, que excede todo o entendimento, guardará o coração e a mente de vocês em Cristo Jesus.",
      reflection: "A paz de Deus não depende de ter todas as respostas hoje, mas de entregar cada inquietação nas mãos dEle.",
    },
    extraQuestion: {
      id: "q-entrega",
      focus: "Entrega do medo",
      question: "Se você entregasse esse receio totalmente nas mãos de Deus agora, o que mudaria na sua paz hoje?",
      hint: "Pense no peso que você não precisa carregar sozinho.",
    },
    faithStep: "Quando o pensamento ansioso voltar hoje, respire fundo e repita em silêncio: 'Senhor, eu já entreguei isso ao Teu cuidado.'",
  },
  {
    keywords: ["decis", "escolha", "caminho", "direç", "direc", "dúvid", "duvid", "trabalh", "empreg", "futur", "plan", "projet"],
    verse: {
      reference: "Provérbios 3:5-6",
      text: "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento; reconheça o Senhor em todos os seus caminhos, e ele endireitará as suas veredas.",
      reflection: "Deus promete guiar nossos passos quando submetemos nossos planos à sabedoria dEle.",
    },
    extraQuestion: {
      id: "q-direcao",
      focus: "Alinhamento",
      question: "Nos desejos e planos que você apresentou, você está disposto a aceitar a direção de Deus mesmo se o tempo ou o caminho forem diferentes do esperado?",
      hint: "A oração amadurece quando une sinceridade e confiança na vontade do Pai.",
    },
    faithStep: "Dê hoje apenas o próximo passo íntegro e possível, sem exigir enxergar todo o percurso de uma vez.",
  },
  {
    keywords: ["perd", "mágoa", "magoa", "raiva", "famíli", "famili", "casament", "filh", "mãe", "mae", "pai", "irmã", "conflit", "brig"],
    verse: {
      reference: "Colossenses 3:13",
      text: "Suportem-se uns aos outros e perdoem as queixas que tiverem uns contra os outros. Perdoem como o Senhor lhes perdoou.",
      reflection: "A graça que recebemos de Cristo nos fortalece para buscar reconciliação e mansidão nos relacionamentos.",
    },
    extraQuestion: {
      id: "q-vinculos",
      focus: "Graça e mansidão",
      question: "Que atitude de mansidão, perdão ou cuidado Deus pode estar convidando você a praticar nessa relação?",
      hint: "Mesmo um pequeno gesto de paz já honra ao Senhor.",
    },
    faithStep: "Escolha uma palavra branda ou uma breve oração silenciosa em favor das pessoas envolvidas nesta situação.",
  },
  {
    keywords: ["cansa", "exaust", "trist", "desânim", "desanim", "sozinh", "dor", "luto", "choro", "frac"],
    verse: {
      reference: "Mateus 11:28",
      text: "Venham a mim, todos os que estão cansados e sobrecarregados, e eu lhes darei descanso.",
      reflection: "Jesus acolhe o cansaço real sem cobranças e oferece descanso verdadeiro para a alma.",
    },
    extraQuestion: {
      id: "q-descanso",
      focus: "Descanso em Deus",
      question: "Qual fardo ou cobrança você tem tentado sustentar com as próprias forças que precisa depositar aos pés de Cristo hoje?",
      hint: "Você não precisa ser forte o tempo todo diante do Pai.",
    },
    faithStep: "Separe hoje alguns minutos sem pressa para descansar o corpo e a mente, lembrando que Deus continua cuidando de tudo.",
  },
  {
    keywords: ["corag", "ousad", "firme", "passo", "mudan", "recomeç", "recomec", "desafi"],
    verse: {
      reference: "Josué 1:9",
      text: "Seja forte e corajoso! Não se apavore nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.",
      reflection: "A coragem cristã nasce da companhia constante de Deus, não da ausência de desafios.",
    },
    extraQuestion: {
      id: "q-coragem",
      focus: "Passo de coragem",
      question: "Qual é o primeiro passo concreto de obediência e coragem que você pode dar com a ajuda de Deus?",
      hint: "Pense em uma ação simples, verdadeira e alinhada ao Evangelho.",
    },
    faithStep: "Execute hoje a menor ação concreta que exige coragem, confiando que o Senhor vai adiante de você.",
  },
];

const DEFAULT_PROFILE: TopicProfile = {
  keywords: [],
  verse: {
    reference: "Salmos 62:8",
    text: "Confiem nele em todos os momentos, ó povo; derramem diante dele o coração, pois ele é o nosso refúgio.",
    reflection: "Deus recebe com amor um coração transparente e nos ensina a descansar na Sua fidelidade.",
  },
  extraQuestion: {
    id: "q-alinhamento",
    focus: "Propósito de Deus",
    question: "De que maneira você deseja que a vontade e a glória de Deus apareçam nessa situação que você está vivendo?",
    hint: "Alinhar o coração ao propósito de Deus traz serenidade e direção.",
  },
  faithStep: "Agradeça hoje por um sinal concreto do cuidado de Deus e caminhe em obediência serena no que está ao seu alcance.",
};

function detectProfile(combinedText: string): TopicProfile {
  const lower = combinedText.toLowerCase();
  let best = DEFAULT_PROFILE;
  let bestScore = 0;

  for (const profile of TOPIC_PROFILES) {
    let score = 0;
    for (const kw of profile.keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = profile;
    }
  }
  return best;
}

function cleanClause(text: string): string {
  return text.trim().replace(/[.!?]+$/, "");
}

function lowercaseFirst(text: string): string {
  if (!text) return "";
  // Preserve uppercase "Deus", "Senhor", "Jesus", "Cristo", "Pai", "Espírito"
  if (/^(Deus|Senhor|Jesus|Cristo|Pai|Espírito)\b/.test(text)) {
    return text;
  }
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function generateOfflineQuestions(
  heart: HeartInput,
  themeContext?: string
): QuestionsResponse {
  const combined = [
    heart.feelings,
    heart.desires,
    heart.fears,
    heart.courage,
    heart.freeText,
    themeContext || "",
  ]
    .filter(Boolean)
    .join(" ");

  const profile = detectProfile(combined);

  const q1: ReflectiveQuestion = heart.feelings.trim()
    ? {
        id: "q-sinceridade",
        focus: "Sinceridade",
        question:
          "Por trás do que você está sentindo hoje, o que o seu coração mais precisa ouvir ou receber de Deus neste momento?",
        hint: "Responda com a simplicidade de um filho falando com o Pai.",
      }
    : {
        id: "q-sinceridade",
        focus: "Sinceridade",
        question:
          "Se pudesse resumir em uma frase sincera o que mais pesa ou alegra o seu coração hoje, o que diria a Deus?",
        hint: "Não precisa usar palavras formais — apenas verdade.",
      };

  const q2: ReflectiveQuestion = profile.extraQuestion;

  const q3: ReflectiveQuestion = heart.courage.trim()
    ? {
        id: "q-gratidao",
        focus: "Fé e Gratidão",
        question:
          "Mesmo no meio desse desafio, por qual sinal da bondade ou fidelidade de Deus você pode agradecer hoje?",
        hint: "A gratidão firma o coração enquanto damos passos de coragem.",
      }
    : {
        id: "q-coragem-final",
        focus: "Coragem e Gratidão",
        question:
          "Onde você precisa da coragem de Deus hoje, e pelo que você gostaria de agradecer antes de encerrar esta oração?",
        hint: "Unir pedido e gratidão fortalece a confiança em Cristo.",
      };

  return {
    acknowledgment:
      "Deus já conhece cada detalhe do que você compartilhou. Reserve um instante para aprofundar seu coração nestas três perguntas.",
    questions: [q1, q2, q3],
  };
}

export function composeOfflinePrayer(
  heart: HeartInput,
  answers: Array<{ question: string; answer: string }>,
  themeContext?: string
): ComposedPrayer {
  const combined = [
    heart.feelings,
    heart.desires,
    heart.fears,
    heart.courage,
    heart.freeText,
    themeContext || "",
    ...answers.map((a) => a.answer),
  ]
    .filter(Boolean)
    .join(" ");

  const profile = detectProfile(combined);

  const paragraphs: string[] = [];

  // Paragraph 1: Honest approach + Feelings + Free text
  const p1Parts: string[] = [
    "Pai amado, entro na Tua presença com sinceridade e sem máscaras, sabendo que Tu me conheces por inteiro e me ouves com amor.",
  ];
  if (heart.feelings.trim()) {
    p1Parts.push(
      `Coloco diante de Ti aquilo que tem habitado o meu coração hoje: ${lowercaseFirst(
        cleanClause(heart.feelings)
      )}.`
    );
  }
  if (heart.freeText.trim()) {
    p1Parts.push(`Senhor, Tu vês também tudo o que trago em mente: ${lowercaseFirst(cleanClause(heart.freeText))}.`);
  }
  paragraphs.push(p1Parts.join(" "));

  // Paragraph 2: Fears + Desires aligned to God's will
  const p2Parts: string[] = [];
  if (heart.fears.trim()) {
    p2Parts.push(
      `Eu não quero esconder os meus temores; entrego nas Tuas mãos o que tem me preocupado: ${lowercaseFirst(
        cleanClause(heart.fears)
      )}. Guarda a minha mente com a Tua paz e lembra-me de que Tu continuas no controle.`
    );
  }
  if (heart.desires.trim()) {
    p2Parts.push(
      `Apresento diante do Teu altar os meus desejos e pretensões: ${lowercaseFirst(
        cleanClause(heart.desires)
      )}. Alinha cada plano meu aos Teus propósitos perfeitos, para que seja feita a Tua vontade acima da minha.`
    );
  }
  if (p2Parts.length > 0) {
    paragraphs.push(p2Parts.join(" "));
  }

  // Paragraph 3: Courage + Reflective answers
  const p3Parts: string[] = [];
  if (heart.courage.trim()) {
    p3Parts.push(
      `Fortalece o meu espírito e dá-me firmeza onde preciso de coragem: ${lowercaseFirst(
        cleanClause(heart.courage)
      )}.`
    );
  }
  const cleanAnswers = answers
    .map((a) => cleanClause(a.answer))
    .filter((a) => a.length > 0);
  if (cleanAnswers.length > 0) {
    const joined = cleanAnswers.map((a) => lowercaseFirst(a)).join("; e também ");
    p3Parts.push(
      `Diante daquilo que refleti em Tua presença, quero caminhar em verdade: ${joined}.`
    );
  }
  if (p3Parts.length > 0) {
    paragraphs.push(p3Parts.join(" "));
  }

  // Paragraph 4: Surrender, gratitude & Amen
  paragraphs.push(
    "Obrigado, Senhor, pela Tua fidelidade que se renova todos os dias e por caminhar comigo em cada passo. Ensina-me a descansar na Tua graça, viver para a Tua glória e confiar no Teu tempo perfeito. Em nome de Jesus, amém."
  );

  let title = "Oração de entrega e confiança em Deus";
  if (heart.fears.trim() && heart.courage.trim()) {
    title = "Entrega dos temores e busca por coragem";
  } else if (heart.desires.trim() && !heart.fears.trim()) {
    title = "Consagração dos desejos à vontade de Deus";
  } else if (heart.fears.trim()) {
    title = "Descanso e paz diante dos temores";
  } else if (heart.courage.trim()) {
    title = "Pedido de coragem e direção no Senhor";
  } else if (themeContext) {
    title = `Oração guiada: ${themeContext.split("(")[0].trim()}`;
  }

  const organizedSummary: { label: string; summary: string }[] = [];
  if (heart.feelings.trim()) {
    organizedSummary.push({ label: "Sentimentos", summary: cleanClause(heart.feelings) });
  }
  if (heart.desires.trim()) {
    organizedSummary.push({ label: "Desejos e sonhos", summary: cleanClause(heart.desires) });
  }
  if (heart.fears.trim()) {
    organizedSummary.push({ label: "Medos entregues", summary: cleanClause(heart.fears) });
  }
  if (heart.courage.trim()) {
    organizedSummary.push({ label: "Onde busca coragem", summary: cleanClause(heart.courage) });
  }
  if (heart.freeText.trim()) {
    organizedSummary.push({ label: "Palavra livre", summary: cleanClause(heart.freeText) });
  }
  if (cleanAnswers.length > 0) {
    organizedSummary.push({
      label: "Reflexões",
      summary: cleanAnswers.join(" · "),
    });
  }

  return {
    title,
    organizedSummary,
    prayerParagraphs: paragraphs,
    structureNotes: [
      {
        stepLabel: "01. Sinceridade diante do Pai",
        lesson:
          "A oração começa trazendo seus sentimentos reais, assim como nos Salmos — Deus valoriza um coração verdadeiro, não palavras ensaiadas.",
      },
      {
        stepLabel: "02. Entrega dos temores e planos",
        lesson:
          "Ao nomear medos e desejos e submetê-los à vontade de Deus, trocamos a ansiedade pelo descanso na soberania dEle.",
      },
      {
        stepLabel: "03. Coragem e ação de graças",
        lesson:
          "Pedir firmeza junto com gratidão alinha nossos próximos passos ao propósito do Evangelho e fortalece a perseverança.",
      },
    ],
    anchorVerse: profile.verse,
    faithStep: profile.faithStep,
  };
}

export function suggestOfflineTheme(topic: string): DailyBiblicalTheme {
  const lower = topic.toLowerCase();
  const matched = DAILY_THEMES.find(
    (t) =>
      t.title.toLowerCase().includes(lower) ||
      t.category.toLowerCase().includes(lower) ||
      t.meditation.toLowerCase().includes(lower)
  );
  if (matched) return matched;

  const profile = detectProfile(topic);
  return {
    id: `offline-${Date.now()}`,
    title: `Direção bíblica para ${topic.trim()}`,
    category: "Propósito",
    suggestedMinutes: 10,
    verseReference: profile.verse.reference,
    verseText: profile.verse.text,
    meditation: profile.verse.reflection,
    prayerDirections: [
      {
        label: "Reconheça",
        prompt: `Agradeça a Deus porque Ele está presente e tem cuidado de você neste momento envolvendo "${topic.trim()}".`,
      },
      {
        label: "Entregue",
        prompt: "Coloque diante do Senhor toda preocupação, dúvida ou peso ligado a esta situação.",
      },
      {
        label: "Peça",
        prompt: "Peça sabedoria, paz e coragem para agir em obediência à Palavra de Deus.",
      },
    ],
  };
}
