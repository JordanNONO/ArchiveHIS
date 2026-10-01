import * as React from "react"

import { cn } from "../../utils"

// Pas de correction orthographique native utile sur ces types (clavier
// numérique/date, ou valeur qui n'est jamais du texte libre en français).
const TYPES_SANS_CORRECTEUR = ['email', 'tel', 'number', 'date', 'password', 'url', 'time', 'datetime-local', 'month', 'week', 'color', 'file', 'checkbox', 'radio', 'hidden'];

const Input = React.forwardRef(({ className, type, spellCheck, lang, autoCorrect, ...props }, ref) => {
  const texteLibre = !TYPES_SANS_CORRECTEUR.includes(type);
  return (
    (<input
      type={type}
      spellCheck={spellCheck ?? texteLibre}
      lang={lang ?? (texteLibre ? 'fr' : undefined)}
      autoCorrect={autoCorrect ?? (texteLibre ? 'on' : undefined)}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
