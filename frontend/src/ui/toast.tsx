// Lightweight toast, mounted once at the app root. No Alert() anywhere.

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles } from "@/src/theme";

type ToastCtx = { toast: (message: string) => void };
const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const toast = useCallback(
    (msg: string) => {
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(
          ({ finished }) => finished && setMessage(null),
        );
      }, 2400);
    },
    [opacity],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { opacity, bottom: insets.bottom + 90 }]}
          testID="app-toast"
        >
          <View style={styles.toast}>
            <Text style={styles.text}>{message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  toast: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 440,
    ...StyleSheet.flatten({
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    }),
  },
  text: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlign: "center",
  },
}));
