import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { translateUi } from "@/lib/app.functions";

export const EN = {
  tagline: "Your partner for life. Wise, warm, and ready for any challenge.",
  start: "Meet Chequetto",
  openChat: "Open chat",
  signIn: "Sign in",
  signUp: "Create account",
  email: "Email",
  password: "Password",
  google: "Continue with Google",
  haveAccount: "Already have an account? Sign in",
  noAccount: "New here? Create an account",
  checkEmail: "Check your email to confirm your account.",
  onbTitle: "Let Chequetto know you",
  onbSub: "Three simple details, and a lifelong companion awakens.",
  fullName: "Full name",
  birthDate: "Birth date",
  city: "City",
  awaken: "Awaken Chequetto",
  reading: "Chequetto is reading your stars…",
  continueChat: "Begin our journey",
  placeholder: "Ask Chequetto anything…",
  send: "Send",
  listen: "Speak",
  voiceOn: "Voice replies on",
  voiceOff: "Voice replies off",
  settings: "Settings",
  signOut: "Sign out",
  language: "Language",
  plan: "Plan",
  trial: "Free trial",
  lifetime: "Lifetime (AppSumo)",
  messagesLeft: "{n} trial messages left",
  trialEnded: "Your trial has ended. Redeem your AppSumo license to keep talking with Chequetto.",
  needsKey: "Add your OpenRouter key in Settings to continue.",
  redeemTitle: "Redeem AppSumo license",
  redeemSub: "Paste the code you received from AppSumo to unlock lifetime access.",
  redeem: "Redeem",
  byokTitle: "Your OpenRouter key",
  byokSub: "Lifetime members use their own OpenRouter key. It's stored securely and never shown again.",
  save: "Save",
  remove: "Remove",
  saved: "Saved",
  thinking: "Chequetto is contemplating…",
  back: "Back to chat",
};
export type Dict = typeof EN;

const BUILTIN: Record<string, Partial<Dict>> = {
  pt: {
    tagline: "Seu parceiro para a vida. Sábio, caloroso e pronto para qualquer desafio.",
    start: "Conheça o Chequetto", openChat: "Abrir chat", signIn: "Entrar", signUp: "Criar conta", password: "Senha",
    google: "Continuar com Google", haveAccount: "Já tem conta? Entrar", noAccount: "Novo aqui? Crie uma conta",
    checkEmail: "Verifique seu e-mail para confirmar a conta.", onbTitle: "Deixe o Chequetto conhecer você",
    onbSub: "Três detalhes simples, e um companheiro para a vida desperta.", fullName: "Nome completo",
    birthDate: "Data de nascimento", city: "Cidade", awaken: "Despertar o Chequetto", reading: "O Chequetto está lendo suas estrelas…",
    continueChat: "Começar nossa jornada", placeholder: "Pergunte qualquer coisa ao Chequetto…", send: "Enviar", listen: "Falar",
    voiceOn: "Respostas por voz ativadas", voiceOff: "Respostas por voz desativadas", settings: "Configurações", signOut: "Sair",
    language: "Idioma", plan: "Plano", trial: "Teste grátis", lifetime: "Vitalício (AppSumo)", messagesLeft: "{n} mensagens de teste restantes",
    trialEnded: "Seu teste terminou. Resgate sua licença AppSumo para continuar.", needsKey: "Adicione sua chave OpenRouter nas Configurações.",
    redeemTitle: "Resgatar licença AppSumo", redeemSub: "Cole o código recebido da AppSumo para liberar o acesso vitalício.", redeem: "Resgatar",
    byokTitle: "Sua chave OpenRouter", byokSub: "Membros vitalícios usam sua própria chave OpenRouter. Ela é guardada com segurança.",
    save: "Salvar", remove: "Remover", saved: "Salvo", thinking: "O Chequetto está contemplando…", back: "Voltar ao chat",
  },
  es: {
    tagline: "Tu compañero para la vida. Sabio, cálido y listo para cualquier desafío.",
    start: "Conoce a Chequetto", openChat: "Abrir chat", signIn: "Iniciar sesión", signUp: "Crear cuenta", email: "Correo", password: "Contraseña",
    google: "Continuar con Google", haveAccount: "¿Ya tienes cuenta? Inicia sesión", noAccount: "¿Nuevo? Crea una cuenta",
    checkEmail: "Revisa tu correo para confirmar tu cuenta.", onbTitle: "Deja que Chequetto te conozca",
    onbSub: "Tres detalles sencillos, y despierta un compañero de por vida.", fullName: "Nombre completo",
    birthDate: "Fecha de nacimiento", city: "Ciudad", awaken: "Despertar a Chequetto", reading: "Chequetto está leyendo tus estrellas…",
    continueChat: "Comenzar nuestro viaje", placeholder: "Pregúntale lo que quieras a Chequetto…", send: "Enviar", listen: "Hablar",
    voiceOn: "Respuestas de voz activadas", voiceOff: "Respuestas de voz desactivadas", settings: "Ajustes", signOut: "Cerrar sesión",
    language: "Idioma", plan: "Plan", trial: "Prueba gratis", lifetime: "De por vida (AppSumo)", messagesLeft: "Quedan {n} mensajes de prueba",
    trialEnded: "Tu prueba terminó. Canjea tu licencia AppSumo para continuar.", needsKey: "Añade tu clave de OpenRouter en Ajustes.",
    redeemTitle: "Canjear licencia AppSumo", redeemSub: "Pega el código de AppSumo para desbloquear el acceso de por vida.", redeem: "Canjear",
    byokTitle: "Tu clave de OpenRouter", byokSub: "Los miembros de por vida usan su propia clave OpenRouter, guardada de forma segura.",
    save: "Guardar", remove: "Eliminar", saved: "Guardado", thinking: "Chequetto está contemplando…", back: "Volver al chat",
  },
};

// Broad list of languages for the selector; any BCP-47 code works.
export const LANGUAGES = "af am ar az be bg bn bs ca cs cy da de el en es et eu fa fi fil fr ga gl gu ha he hi hr ht hu hy id ig is it ja jv ka kk km kn ko ku ky lo lt lv mg mi mk ml mn mr ms mt my ne nl no ny or pa pl ps pt qu ro ru rw sd si sk sl sm sn so sq sr st su sv sw ta te tg th tk tr tt ug uk ur uz vi xh yi yo zh zu".split(" ");

export function languageName(code: string, inLang = code) {
  try {
    return new Intl.DisplayNames([inLang], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

type Ctx = { lang: string; t: (k: keyof Dict, vars?: Record<string, string | number>) => string; setLang: (l: string) => void };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("en");
  const [dict, setDict] = useState<Dict>(EN);

  useEffect(() => {
    const saved = localStorage.getItem("chq-lang");
    const detected = ((saved || navigator.language || "en").split("-")[0] ?? "en").toLowerCase();
    setLangState(detected);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = ["ar", "he", "fa", "ur", "ps", "sd", "yi", "ug", "ku"].includes(lang) ? "rtl" : "ltr";
    if (lang === "en") return setDict(EN);
    if (BUILTIN[lang]) return setDict({ ...EN, ...BUILTIN[lang] });
    const cacheKey = `chq-dict-${lang}-v1`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return setDict({ ...EN, ...JSON.parse(cached) });
    setDict(EN);
    translateUi({ data: { language: lang, strings: EN } })
      .then((d) => {
        localStorage.setItem(cacheKey, JSON.stringify(d));
        setDict({ ...EN, ...d });
      })
      .catch(() => {});
  }, [lang]);

  const setLang = useCallback((l: string) => {
    localStorage.setItem("chq-lang", l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (k: keyof Dict, vars?: Record<string, string | number>) =>
      Object.entries(vars ?? {}).reduce((s, [a, b]) => s.replace(`{${a}}`, String(b)), (dict[k] ?? EN[k]) as string),
    [dict],
  );

  return <I18nCtx.Provider value={{ lang, t, setLang }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
