import type { Metadata } from "next";
import Courtroom from "./components/Courtroom";

export const metadata: Metadata = {
  title: "AI Courtroom · Gavel",
  description:
    "Two advocate AI agents argue where four friends eat Friday night, citing live taste-graph evidence, until the judge delivers a verdict.",
};

export default function Home() {
  return <Courtroom />;
}
