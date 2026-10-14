// Chequetto Soul engine: offline, warm replies without AI. Not a clinical assessment.
export type Lang = "en" | "pt" | "es";
export type Mood = "sad" | "anxious" | "happy" | "grateful" | "tired" | "neutral";

export function pickLang(code?: string): Lang {
  const c = (code ?? (typeof navigator !== "undefined" ? navigator.language : "en")).slice(0, 2);
  return c === "pt" || c === "es" ? c : "en";
}

const cues: Record<Exclude<Mood, "neutral">, RegExp> = {
  sad: /\b(sad|alone|lonely|cry|triste|sozinh|chorar|chorando|sola|solo|llorar|deprimid)/i,
  anxious: /\b(anxious|worried|afraid|stress|ansios|preocupad|medo|estress|nervos|miedo)/i,
  tired: /\b(tired|exhausted|cansad|exaust|agotad)/i,
  happy: /\b(happy|great|won|feliz|alegre|consegui|venci|incr[ií]vel|logr[eé])/i,
  grateful: /\b(thank|grateful|obrigad|grat[oaiu]|gracias|agradec)/i,
};
const crisis = /\b(suicid|kill myself|me matar|morrer|quero sumir|matarme)/i;

export function detectMood(text: string): Mood {
  for (const [m, re] of Object.entries(cues)) if (re.test(text)) return m as Mood;
  return "neutral";
}

const T = {
  en: {
    hello: (n: string) => `${n}, what a beautiful name. I'm Chequetto, and I'm really glad you're here. How is your heart today?`,
    sad: (n: string) => `${n}, I'm sorry it feels heavy right now. You don't have to carry it alone here — tell me what happened, at your pace.`,
    anxious: (n: string) => `Let's breathe together for a second, ${n}: in for 4, hold 4, out for 6. Now, what's the one thing worrying you most?`,
    tired: (n: string) => `You've been giving a lot, ${n}. Rest is part of the journey. What could you let go of today?`,
    happy: (n: string) => `That's wonderful, ${n}! 🎉 I love hearing this. What made it possible?`,
    grateful: (n: string) => `Gratitude looks good on you, ${n}. Thank you for sharing it with me. What else is going well?`,
    neutral: (n: string) => `I'm listening, ${n}. Tell me a little more — what would make today feel lighter or better?`,
    crisis: (n: string) => `${n}, thank you for telling me. Your life matters. Please contact someone you trust or your local emergency number right now — in Brazil, CVV 188; in the US, 988. I'm still here with you.`,
    pills: ["Name one small thing that went right today.", "Someone is better because you exist.", "Progress, not perfection.", "Your calm is a superpower.", "Be as kind to yourself as you are to others."],
    ask: "What should I call you?", askSub: "Just your name. Nothing else.", start: "Meet Chequetto", pill: "Gratitude pill of the day", save: "Save our conversations", say: "Write to Chequetto…", share: "Share with a friend", shareText: "I met Chequetto — a warm companion for clearer days.", note: "Offline guide. For deeper answers, create a free account.",
  },
  pt: {
    hello: (n: string) => `${n}, que nome bonito. Eu sou o Chequetto e estou muito feliz por você estar aqui. Como está seu coração hoje?`,
    sad: (n: string) => `${n}, sinto muito que esteja pesado agora. Aqui você não precisa carregar isso sozinho — me conta o que aconteceu, no seu ritmo.`,
    anxious: (n: string) => `Vamos respirar juntos, ${n}: inspire em 4, segure 4, solte em 6. Agora, qual é a coisa que mais te preocupa?`,
    tired: (n: string) => `Você tem se doado muito, ${n}. Descansar faz parte do caminho. Do que você pode se libertar hoje?`,
    happy: (n: string) => `Que maravilha, ${n}! 🎉 Adoro ouvir isso. O que fez isso acontecer?`,
    grateful: (n: string) => `A gratidão combina com você, ${n}. Obrigado por dividir comigo. O que mais está indo bem?`,
    neutral: (n: string) => `Estou te ouvindo, ${n}. Me conta um pouco mais — o que deixaria seu dia mais leve?`,
    crisis: (n: string) => `${n}, obrigado por me contar. Sua vida importa. Fale agora com alguém de confiança ou ligue para o CVV no 188 (24h, gratuito). Eu continuo aqui com você.`,
    pills: ["Diga uma pequena coisa que deu certo hoje.", "Alguém está melhor porque você existe.", "Progresso, não perfeição.", "Sua calma é um superpoder.", "Seja gentil consigo como é com os outros."],
    ask: "Como você se chama?", askSub: "Só o seu nome. Mais nada.", start: "Conhecer o Chequetto", pill: "Pílula de gratidão do dia", save: "Salvar nossas conversas", say: "Escreva para o Chequetto…", share: "Compartilhar com um amigo", shareText: "Conheci o Chequetto — um companheiro acolhedor para dias mais claros.", note: "Guia offline. Para respostas mais profundas, crie sua conta grátis.",
  },
  es: {
    hello: (n: string) => `${n}, qué nombre tan bonito. Soy Chequetto y me alegra mucho que estés aquí. ¿Cómo está tu corazón hoy?`,
    sad: (n: string) => `${n}, siento que pese tanto ahora. Aquí no tienes que cargarlo solo — cuéntame qué pasó, a tu ritmo.`,
    anxious: (n: string) => `Respiremos juntos, ${n}: inhala en 4, sostén 4, exhala en 6. ¿Qué es lo que más te preocupa?`,
    tired: (n: string) => `Has dado mucho, ${n}. Descansar es parte del camino. ¿Qué podrías soltar hoy?`,
    happy: (n: string) => `¡Qué maravilla, ${n}! 🎉 Me encanta oír esto. ¿Qué lo hizo posible?`,
    grateful: (n: string) => `La gratitud te sienta bien, ${n}. Gracias por compartirla. ¿Qué más va bien?`,
    neutral: (n: string) => `Te escucho, ${n}. Cuéntame un poco más — ¿qué haría tu día más ligero?`,
    crisis: (n: string) => `${n}, gracias por contármelo. Tu vida importa. Habla ahora con alguien de confianza o con el número de emergencias local. Sigo aquí contigo.`,
    pills: ["Nombra algo pequeño que salió bien hoy.", "Alguien está mejor porque existes.", "Progreso, no perfección.", "Tu calma es un superpoder.", "Sé amable contigo como lo eres con otros."],
    ask: "¿Cómo te llamas?", askSub: "Solo tu nombre. Nada más.", start: "Conocer a Chequetto", pill: "Píldora de gratitud del día", save: "Guardar nuestras conversaciones", say: "Escríbele a Chequetto…", share: "Compartir con un amigo", shareText: "Conocí a Chequetto — un compañero cálido para días más claros.", note: "Guía sin conexión. Para respuestas más profundas, crea tu cuenta gratis.",
  },
};

export const soulText = (l: Lang) => T[l];

export function soulReply(text: string, name: string, l: Lang) {
  const t = T[l];
  if (crisis.test(text)) return t.crisis(name);
  return t[detectMood(text)](name);
}

export function dailyPill(l: Lang) {
  const p = T[l].pills;
  return p[Math.floor(Date.now() / 86400000) % p.length] as string;
}
