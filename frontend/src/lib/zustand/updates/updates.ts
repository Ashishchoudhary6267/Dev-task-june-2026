import { create } from 'zustand';

interface UpdateState {
    hasUpdates: boolean;
    setHasUpdates: (val: boolean) => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
    hasUpdates: false,
    setHasUpdates: (val) => set({ hasUpdates: val }),
}));
