import { AppState } from './appStore.types';

export type AppStoreSet = (
  partial:
    | AppState
    | Partial<AppState>
    | ((state: AppState) => AppState | Partial<AppState>),
  replace?: false
) => void;

export type AppStoreGet = () => AppState;
