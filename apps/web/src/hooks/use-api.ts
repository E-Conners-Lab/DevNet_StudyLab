import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiOptions<T> {
  /** API endpoint URL */
  url: string;
  /** Transform the raw JSON before storing */
  transform?: (data: unknown) => T;
  /** Skip the fetch entirely when true */
  skip?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Lightweight hook for GET-fetching JSON data with loading/error state.
 * Replaces the repeated useEffect → fetch → setState boilerplate.
 */
export function useApi<T>({ url, transform, skip }: UseApiOptions<T>): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(transformRef.current ? transformRef.current(json) : json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (skip) return;
    fetchData();
  }, [fetchData, skip]);

  return { data, isLoading, error, refetch: fetchData };
}
