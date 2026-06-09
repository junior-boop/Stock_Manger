import { create } from 'zustand'

type OpenLayout = {
    open_state: boolean
    open_set: () => void
}

export const openNewProductWindow = create<OpenLayout>()((set) => ({
    open_state: false,
    open_set: () => set((state) => ({ open_state: !state.open_state })),
}))

type OpenSousCollection = {
    open_sous : boolean
    set_sous : () => void
}

export const OpenSousCollection = create<OpenSousCollection>()((set) => ({
    open_sous: false,
    set_sous: () => set((state) => ({ open_sous: !state.open_sous })),
}))

type OpenImportExcel = {
    open_import: boolean
    set_import: () => void
}

export const useImportExcelStore = create<OpenImportExcel>()((set) => ({
    open_import: false,
    set_import: () => set((state) => ({ open_import: !state.open_import })),
}))