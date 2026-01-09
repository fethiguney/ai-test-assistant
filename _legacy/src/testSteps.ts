export type TestStep =
  | { action: "goto"; page: "loginPage" }
  | { action: "fill"; field: "username" | "password"; value: string }
  | { action: "click"; element: "loginButton" }
  | { action: "expectVisible"; element: "loginSuccessMessage" };

