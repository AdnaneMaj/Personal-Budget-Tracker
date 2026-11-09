import { useState, useEffect } from "react";

export default function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    fn()
      .then((data) => active && setState({ loading: false, error: "", data }))
      .catch(
        (error) =>
          active &&
          setState({ loading: false, error: error.message, data: null }),
      );
    return () => {
      active = false;
    };
  }, deps);

  return state;
}
