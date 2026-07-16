import { useState, type FormEvent } from "react";

export function useFakeSubmit(onSuccess: () => void) {
  const [loading, setLoading] = useState(false);
  return {
    loading,
    onSubmit: (event: FormEvent) => {
      event.preventDefault();
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        onSuccess();
      }, 700);
    },
  };
}
