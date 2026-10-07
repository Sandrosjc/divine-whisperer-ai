import { LANGUAGES, languageName, useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FLAGS: Record<string, string> = { en: "🇺🇸", pt: "🇧🇷", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", ja: "🇯🇵", ko: "🇰🇷", zh: "🇨🇳", ar: "🇸🇦", hi: "🇮🇳", ru: "🇷🇺", nl: "🇳🇱", tr: "🇹🇷", uk: "🇺🇦", pl: "🇵🇱" };

export function LanguageSelect({ onChange }: { onChange?: (l: string) => void }) {
  const { lang, setLang, t } = useI18n();
  const list = LANGUAGES.includes(lang) ? LANGUAGES : [lang, ...LANGUAGES];
  return (
    <Select value={lang} onValueChange={(value) => {
          setLang(value);
          onChange?.(value);
        }}
      >
      <SelectTrigger aria-label={t("language")} className="w-32 border-0 bg-transparent text-xs shadow-none"><SelectValue /></SelectTrigger>
      <SelectContent>
        {list.map((c) => (
          <SelectItem key={c} value={c}>{FLAGS[c] ?? "🌐"} {languageName(c)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
