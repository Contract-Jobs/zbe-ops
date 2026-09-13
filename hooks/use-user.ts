import { useQuery } from "@tanstack/react-query";
import authClient from "@/lib/auth/client";

export function useUser(userId?: string | null) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await authClient.admin.getUser({
        query: { id: userId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
