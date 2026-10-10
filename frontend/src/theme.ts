// TeachOps design tokens. Light + dark, keys mirror design_guidelines.json.
// Premium Geist typography is loaded in app/_layout.tsx; reference families via
// the exported `fonts` object (custom fonts need an explicit fontFamily, not
// fontWeight).

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

export const fonts = {
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
} as const;

const light = {
  surface: "#FFFFFF",
  onSurface: "#0F1115",
  surfaceSecondary: "#F4F5F7",
  onSurfaceSecondary: "#1E232B",
  surfaceTertiary: "#EAECEF",
  onSurfaceTertiary: "#2D333B",
  surfaceInverse: "#0F1115",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B7280",

  brand: "#3B82F6",
  onBrand: "#FFFFFF",
  brandPrimary: "#3B82F6",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#EFF6FF",
  onBrandSecondary: "#1D4ED8",
  brandTertiary: "#DBEAFE",
  onBrandTertiary: "#1E40AF",

  success: "#0E9F6E",
  onSuccess: "#FFFFFF",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#2563EB",
  onInfo: "#FFFFFF",

  border: "#E2E4E9",
  borderStrong: "#CBD1DA",
  divider: "#EEF0F3",
};

const dark: typeof light = {
  surface: "#0D0E12",
  onSurface: "#ECEEF6",
  surfaceSecondary: "#16181F",
  onSurfaceSecondary: "#D4D7E0",
  surfaceTertiary: "#1E212A",
  onSurfaceTertiary: "#AEB3C2",
  surfaceInverse: "#ECEEF6",
  onSurfaceInverse: "#0D0E12",
  muted: "#8A90A2",

  brand: "#3B82F6",
  onBrand: "#FFFFFF",
  brandPrimary: "#3B82F6",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#16213A",
  onBrandSecondary: "#93B4FF",
  brandTertiary: "#1E2A44",
  onBrandTertiary: "#BBD0FF",

  success: "#34D399",
  onSuccess: "#06281C",
  warning: "#FBBF24",
  onWarning: "#3A2A08",
  error: "#F87171",
  onError: "#3A1414",
  info: "#60A5FA",
  onInfo: "#06182E",

  border: "#262A33",
  borderStrong: "#363B47",
  divider: "#1C1F27",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// hex (#RRGGBB) + alpha(0..1) -> #RRGGBBAA. Used for status pill tints.
export function hexA(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
