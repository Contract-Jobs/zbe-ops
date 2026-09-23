import { useQuery } from "@tanstack/react-query"
import * as tasksApi from "@/lib/api/tasks"
import type { TaskListParams } from "@/lib/api/tasks"
import { queryKeys } from "@/lib/query/keys"

export function useTasks(params: TaskListParams = {}) {
    return useQuery({
        queryKey: queryKeys.tasks.list(params),
        queryFn: () => tasksApi.listTasks(params),
    })
}

export function useTask(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.tasks.detail(id ?? ""),
        queryFn: () => tasksApi.getTask(id as string),
        enabled: !!id,
    })
}
