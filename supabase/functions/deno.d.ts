declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): { [index: string]: string };
  }
  export const env: Env;
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "https://deno.land/std@0.224.0/encoding/base64.ts" {
  export function encodeBase64(input: ArrayBuffer | Uint8Array | string): string;
}

