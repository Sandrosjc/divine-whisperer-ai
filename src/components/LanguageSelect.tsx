import { Globe2 } from "lucide-react";
import { LANGUAGES, languageName, useI18n } from "@/lib/i18n";

export function LanguageSelect({ onChange }: { onChange?: (l: string) => void }) {
  const { lang, setLang } = useI18n();
  const list = LANGUAGES.includes(lang) ? LANGUAGES : [lang, ...LANGUAGES];
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <Globe2 className="h-4 w-4 text-gold" />
      <select
        aria-label="Language"
        value={lang}
        onChange={(e) => {
          setLang(e.target.value);
          onChange?.(e.target.value);
        }}
        className="rounded-md border bg-card px-2 py-1 text-foreground"
      >
        {list.map((c) => (
          <option key={c} value={c}>
            {languageName(c)}
          </option>
        ))}
      </select>
    </label>
  );
}
