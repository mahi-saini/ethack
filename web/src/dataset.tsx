import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Dataset, Weights } from "./types";
import { DEFAULT_WEIGHTS } from "./lib/scoring";

type Ctx = {
  dataset: Dataset;
  weights: Weights;
  setWeights: (next: Weights) => void;
};

const DatasetContext = createContext<Ctx | null>(null);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  useEffect(() => {
    fetch("/data/eseg_master.json")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load the Green Liquid scores.");
        return res.json();
      })
      .then(setDataset)
      .catch((err: Error) => setError(err.message));
  }, []);

  const value = useMemo(
    () => (dataset ? { dataset, weights, setWeights } : null),
    [dataset, weights],
  );

  if (error) {
    return (
      <div className="error">
        <h1>The scores did not pour.</h1>
        <p>{error} Run <code>python3 scripts/build_eseg_dataset.py</code> and refresh.</p>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="loading">
        <img className="loading-logo" src="/green_liquid_logo.png" alt="" />
        <h1>Pouring the scores…</h1>
        <p className="muted">Reading S&P 500 filings into plain language.</p>
      </div>
    );
  }
  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset() {
  const ctx = useContext(DatasetContext);
  if (!ctx) throw new Error("Dataset missing");
  return ctx;
}
