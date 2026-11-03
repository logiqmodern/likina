"use client";

import { type FormEvent, useTransition } from "react";

/**
 * onSubmit handler that sends the form's data to a `useActionState` dispatch
 * WITHOUT React's automatic form reset (which `<form action>` does after every
 * submit). Entered values stay in place after a validation error; reset the
 * form yourself on success when that is wanted.
 */
export function useSubmitKeepingValues(dispatch: (fd: FormData) => void) {
  const [, startTransition] = useTransition();
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
}
