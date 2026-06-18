import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the header and date controls", () => {
    render(<App />);
    expect(screen.getByText("Powder Window")).toBeTruthy();
    expect(screen.getByDisplayValue(/2026/)).toBeTruthy();
    expect(screen.getByText("Todas as regiões")).toBeTruthy();
  });
});
