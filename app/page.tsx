"use client";

import { useState } from "react";
import Courtroom from "./components/Courtroom";
import SetupScreen, { type DebateConfig } from "./components/SetupScreen";

export default function Home() {
  const [config, setConfig] = useState<DebateConfig | null>(null);

  if (!config) {
    return <SetupScreen onStart={setConfig} />;
  }
  return <Courtroom config={config} onBack={() => setConfig(null)} />;
}
