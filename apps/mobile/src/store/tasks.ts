import { create } from 'zustand';
import { NearbyTask, Task } from '@lokeye/shared';
import * as api from '../services/api';

interface TaskState {
  nearbyTasks: NearbyTask[];
  activeTask: Task | null;
  isLoading: boolean;
  error: string | null;
  fetchNearbyTasks: (lat: number, lng: number) => Promise<void>;
  fetchActiveTask: () => Promise<void>;
  acceptTask: (taskId: string) => Promise<Task>;
  startTask: (taskId: string) => Promise<Task>;
  acceptAndStartTask: (taskId: string) => Promise<Task>;
  submitTask: (taskId: string, data: Parameters<typeof api.submitTask>[1]) => Promise<void>;
  abandonTask: (taskId: string) => Promise<void>;
  clearActiveTask: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  nearbyTasks: [],
  activeTask: null,
  isLoading: false,
  error: null,

  fetchNearbyTasks: async (lat: number, lng: number) => {
    set({ isLoading: true, error: null });
    try {
      const tasks = await api.getNearbyTasks(lat, lng);
      set({ nearbyTasks: tasks, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchActiveTask: async () => {
    try {
      const task = await api.getActiveTask();
      set({ activeTask: task });
    } catch (err) {
      console.error('Failed to fetch active task:', err);
    }
  },

  acceptTask: async (taskId: string) => {
    const task = await api.acceptTask(taskId);
    set({
      activeTask: task,
      nearbyTasks: get().nearbyTasks.filter(t => t.id !== taskId),
    });
    return task;
  },

  startTask: async (taskId: string) => {
    const startedTask = await api.startTask(taskId);
    set({ activeTask: startedTask });
    return startedTask;
  },

  // Accept + start in one call, throws on failure so UI can handle it
  acceptAndStartTask: async (taskId: string) => {
    const task = await api.acceptTask(taskId);
    // Immediately start the task
    const startedTask = await api.startTask(taskId);
    set({
      activeTask: startedTask,
      nearbyTasks: get().nearbyTasks.filter(t => t.id !== taskId),
    });
    return startedTask;
  },

  submitTask: async (taskId: string, data) => {
    await api.submitTask(taskId, data);
    set({ activeTask: null });
  },

  abandonTask: async (taskId: string) => {
    await api.abandonTask(taskId);
    set({ activeTask: null });
  },

  clearActiveTask: () => set({ activeTask: null }),
}));

