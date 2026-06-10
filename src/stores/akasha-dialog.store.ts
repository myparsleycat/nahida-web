import { createStore, useStore } from "zustand";

type DialogResolve = (result: any) => void;

interface BaseDialogState {
    open: boolean;
    data?: any;
}

interface ClearPrefixData {
    id: string | null;
    name: string;
    inProgress: boolean;
}

interface DialogStates {
    gamebananaDialog: BaseDialogState;
    emptyTrashDialog: BaseDialogState;
    createDirDialog: BaseDialogState;
    renameDialog: BaseDialogState;
    previewDialog: BaseDialogState;
    shareDialog: BaseDialogState & { data: { id: string } };
    searchCommand: BaseDialogState;
    conflictNameDialog: BaseDialogState;
    clearPrefixDialog: BaseDialogState & { data: ClearPrefixData };
    searchDialog: BaseDialogState;
    notiDialog: BaseDialogState;
}

type DialogName = keyof DialogStates;
type DialogData<T extends DialogName> = DialogStates[T]["data"];

interface DialogActions {
    anyDialogOpen: () => boolean;
    getDialogState: <T extends DialogName>(dialogName: T) => DialogStates[T];
    setOpen: <T extends DialogName>(
        dialogName: T,
        isOpen: boolean,
        data?: Partial<DialogData<T>>,
    ) => void;
    toggleDialog: <T extends DialogName>(dialogName: T, data?: Partial<DialogData<T>>) => void;
    updateDialogData: <T extends DialogName>(dialogName: T, data: Partial<DialogData<T>>) => void;
    showDialog: <R = boolean, T extends DialogName = DialogName>(
        dialogName: T,
        data?: Partial<DialogData<T>>,
    ) => Promise<R>;
    resolveDialog: <R = boolean>(dialogName: DialogName, result: R) => void;
    updateDialogField: <T extends DialogName, K extends keyof DialogData<T>>(
        dialogName: T,
        field: K,
        value: DialogData<T>[K],
    ) => void;
}

const activeDialogs: Record<DialogName, DialogResolve | null> = {} as Record<
    DialogName,
    DialogResolve | null
>;

export const dialogStore = createStore<DialogStates & DialogActions>((set, get) => ({
    gamebananaDialog: { open: false, data: {} },
    emptyTrashDialog: { open: false, data: {} },
    createDirDialog: { open: false, data: {} },
    renameDialog: { open: false, data: {} },
    previewDialog: { open: false, data: {} },
    shareDialog: { open: false, data: { id: "" } },
    searchCommand: { open: false, data: {} },
    conflictNameDialog: { open: false, data: {} },
    clearPrefixDialog: {
        open: false,
        data: { id: null, name: "", inProgress: false },
    },
    searchDialog: { open: false, data: {} },
    notiDialog: { open: false, data: {} },

    anyDialogOpen: () => {
        const state = get();
        return Object.values(state).some(
            (dialogState) =>
                typeof dialogState === "object" &&
                dialogState !== null &&
                "open" in dialogState &&
                dialogState.open,
        );
    },

    getDialogState: (dialogName) => {
        return get()[dialogName];
    },

    setOpen: (dialogName, isOpen, data) =>
        set((state) => ({
            ...state,
            [dialogName]: {
                ...state[dialogName],
                open: isOpen,
                data: isOpen
                    ? data
                        ? { ...state[dialogName].data, ...data }
                        : state[dialogName].data
                    : undefined,
            },
        })),

    toggleDialog: (dialogName, data) =>
        set((state) => {
            const isOpen = !state[dialogName].open;
            return {
                ...state,
                [dialogName]: {
                    ...state[dialogName],
                    open: isOpen,
                    data:
                        isOpen && data
                            ? {
                                  ...state[dialogName].data,
                                  ...data,
                              }
                            : state[dialogName].data,
                },
            };
        }),

    updateDialogData: (dialogName, data) =>
        set((state) => ({
            ...state,
            [dialogName]: {
                ...state[dialogName],
                data: {
                    ...state[dialogName].data,
                    ...data,
                },
            },
        })),

    showDialog: (dialogName, data) => {
        return new Promise((resolve) => {
            activeDialogs[dialogName] = resolve as DialogResolve;

            set((state) => ({
                ...state,
                [dialogName]: {
                    ...state[dialogName],
                    open: true,
                    data: {
                        ...state[dialogName].data,
                        ...(data || {}),
                    },
                },
            }));
        });
    },

    resolveDialog: (dialogName, result) => {
        if (activeDialogs[dialogName]) {
            activeDialogs[dialogName]!(result);
            activeDialogs[dialogName] = null;
        }
    },

    updateDialogField: (dialogName, field, value) =>
        set((state) => ({
            ...state,
            [dialogName]: {
                ...state[dialogName],
                data: {
                    ...state[dialogName].data,
                    [field]: value,
                },
            },
        })),
}));

export const useDialogStore = () => useStore(dialogStore);
