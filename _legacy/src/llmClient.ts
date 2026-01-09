
export async function generateTestSteps(
  testScenario: string
): Promise<string> {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:7b",
      prompt: `
You are an expert QA engineer.

STRICT RULES:
- Use actions similar to: goto, fill, click, expectVisible
- If unsure, use the closest action
- Do NOT invent new concepts

Allowed pages:
- loginPage

Allowed fields:
- username
- password

Allowed elements:
- loginButton
- loginSuccessMessage

Return ONLY valid JSON array


Manual test scenario:
${testScenario}
      `,
      stream: false
    })
  });

  
  const data = await response.json();
  return data.response;
}

export function extractJson(text: string): string {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

