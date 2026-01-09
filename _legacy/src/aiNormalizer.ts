import { TestStep } from "./testSteps";

export function normalizeAiSteps(rawSteps: any[]): TestStep[] {
  return rawSteps.map((step) => {
    switch (step.action || step.expected) {
      case "navigate":
      case "goto":
        return { action: "goto", page: "loginPage" };

      case "enterText":
      case "fill":
        return {
          action: "fill",
          field: step.field,
          value: step.value
        };

      case "click":
        return {
          action: "click",
          element: step.element
        };

      case "visible":
      case "expectVisible":
        return {
          action: "expectVisible",
          element: step.element
        };

      default:
        throw new Error(`Unsupported AI action: ${JSON.stringify(step)}`);
    }
  });
}
