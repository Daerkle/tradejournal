"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Parse, initializeParse } from "@/lib/parse";

interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: { url: string };
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        initializeParse();
        set({ isLoading: true });
        try {
          const user = await Parse.User.logIn(username, password);
          set({
            user: {
              id: user.id ?? "",
              username: user.get("username") ?? username,
              email: user.get("email"),
              avatar: user.get("avatar"),
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (
        username: string,
        email: string,
        password: string
      ) => {
        initializeParse();
        set({ isLoading: true });
        try {
          const user = new Parse.User();
          user.set("username", username);
          user.set("email", email);
          user.set("password", password);
          await user.signUp();
          set({
            user: {
              id: user.id ?? "",
              username: user.get("username") ?? username,
              email: user.get("email") ?? email,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        initializeParse();
        await Parse.User.logOut();
        set({ user: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        initializeParse();
        set({ isLoading: true });
        try {
          const currentUser = Parse.User.current();
          if (currentUser) {
            set({
              user: {
                id: currentUser.id ?? "",
                username: currentUser.get("username") ?? "",
                email: currentUser.get("email"),
                avatar: currentUser.get("avatar"),
              },
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
