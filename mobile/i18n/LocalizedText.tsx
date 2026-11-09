import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { Text as NativeText, TextInput as NativeTextInput, type TextProps, type TextInputProps } from "react-native";
import { useLanguageStore, type LanguageCode } from "../store/languageStore";
import { translate } from "../utils/language";

export function translateChildren(children: ReactNode, language: LanguageCode): ReactNode {
  if (typeof children === "string") return translate(children, language);
  if (Array.isArray(children)) return children.map((child) => translateChildren(child, language));
  return children;
}

// NativeWind still processes the native primitives below. Refs, input values,
// event handlers, IDs and API payloads are forwarded without translation.
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps & { localize?: boolean }>(
  function LocalizedText({ children, localize = true, accessibilityLabel, ...props }, ref) {
    const language = useLanguageStore((state) => state.language);
    return <NativeText {...props} ref={ref} accessibilityLabel={accessibilityLabel ? translate(accessibilityLabel, language) : accessibilityLabel}>
      {localize ? translateChildren(children, language) : children}
    </NativeText>;
  },
);

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(
  function LocalizedTextInput({ placeholder, accessibilityLabel, ...props }, ref) {
    const language = useLanguageStore((state) => state.language);
    return <NativeTextInput
      {...props}
      ref={ref}
      placeholder={placeholder ? translate(placeholder, language) : placeholder}
      accessibilityLabel={accessibilityLabel ? translate(accessibilityLabel, language) : accessibilityLabel}
    />;
  },
);
