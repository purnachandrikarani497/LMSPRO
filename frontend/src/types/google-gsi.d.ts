/** Google Identity Services (Sign in with Google) — loaded from accounts.google.com/gsi/client */

export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              width?: number;
              text?: string;
              locale?: string;
            }
          ) => void;
        };
      };
    };
    __lmsGoogleGsiInitialized?: boolean;
  }
}
