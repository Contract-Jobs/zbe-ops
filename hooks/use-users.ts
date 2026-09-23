import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import authClient from "@/lib/auth/client";
import type { Role, User } from "@/types/api";
import { updateUserRole, updateUserBan } from "@/lib/store";

export function useUsers(params: Record<string, unknown> = { query: { limit: 100 } }) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: async () => {
      const { data, error } = await authClient.admin.listUsers(params as any);
      if (error) throw error;
      return data as unknown as { users: User[] };
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { data, error } = await authClient.admin.setRole({ userId, role: role as any });
      if (error) {
        if (process.env.NEXT_PUBLIC_USE_DEMO === "true") {
          updateUserRole(userId, role);
          return { success: true };
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, banReason }: { userId: string; banReason?: string }) => {
      const { data, error } = await authClient.admin.banUser({ userId, banReason });
      if (error) {
        if (process.env.NEXT_PUBLIC_USE_DEMO === "true") {
          updateUserBan(userId, true);
          return { success: true };
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await authClient.admin.unbanUser({ userId });
      if (error) {
        if (process.env.NEXT_PUBLIC_USE_DEMO === "true") {
          updateUserBan(userId, false);
          return { success: true };
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

export function useRemoveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await authClient.admin.removeUser({ userId });
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

export function useSetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data, error } = await authClient.admin.setUserPassword({ userId, newPassword: password });
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; name: string; password?: string; role: string }) => {
      const { data: result, error } = await authClient.admin.createUser({
        email: data.email,
        name: data.name,
        password: data.password || "password123",
        role: data.role as any,
      });
      if (error) {
        if (process.env.NEXT_PUBLIC_USE_DEMO === "true") {
          const id = "usr_" + data.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          import("@/lib/store").then(({ createUser }) => {
            createUser({
              id,
              name: data.name,
              email: data.email,
              role: data.role,
              siteIds: [],
            });
          });
          return { success: true };
        }
        throw error;
      }
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { name?: string; email?: string } }) => {
      const { data: result, error } = await authClient.admin.updateUser({ userId, data });
      if (error) {
        if (process.env.NEXT_PUBLIC_USE_DEMO === "true") {
          import("@/lib/store").then(({ updateUser }) => {
            updateUser(userId, data);
          });
          return { success: true };
        }
        throw error;
      }
      return result;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      // <Username> (BalanceHistory, lifecycle logs, transactions, equipment
      // history — everywhere a `loggedBy` renders) reads useUser(userId),
      // keyed as ["user", userId] — a different top-level key this never
      // touched, so a rename stayed stale for its 5-minute staleTime.
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}
