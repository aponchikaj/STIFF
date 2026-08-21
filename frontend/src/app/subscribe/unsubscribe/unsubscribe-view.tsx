"use client";

import { subscribersApi } from "@/lib/api";
import { TokenPage } from "../token-page";

export function UnsubscribeView() {
  return (
    <TokenPage
      title="Done"
      action={(token) => subscribersApi.unsubscribe(token)}
      success={(email) => (
        <p className="max-w-md text-sm leading-7 text-muted">
          {email} is off the drop list. No confirmation email about the
          unsubscribe, because that would be one more email.
        </p>
      )}
    >
      <p className="max-w-md text-sm leading-7 text-muted">
        Changed your mind later? The signup form on the home page takes you
        straight back.
      </p>
    </TokenPage>
  );
}
