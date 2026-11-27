import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("홈 화면", () => {
  it("서비스 이름을 보여 준다", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Loom" })).toBeInTheDocument();
  });
});
