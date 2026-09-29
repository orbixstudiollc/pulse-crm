"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-center"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      closeButton
    />
  );
}
