import chai from "chai";
import { setupErrorMatchers } from "./errorMessages";

// Setup custom error matchers for tests
setupErrorMatchers(chai);

export { chai };
export const { expect } = chai;

function extractErrorMessages(error: any, seen = new Set<any>()): string[] {
  if (!error || seen.has(error)) {
    return [];
  }
  seen.add(error);

  const messages: string[] = [];
  const fields: Array<keyof typeof error> = [
    "shortMessage",
    "message",
    "details",
  ];

  for (const field of fields) {
    const value = error?.[field];
    if (typeof value === "string" && value.trim().length > 0) {
      messages.push(value);
    }
  }

  if (Array.isArray(error?.metaMessages)) {
    messages.push(error.metaMessages.join(" | "));
  }

  if (error?.cause) {
    messages.push(...extractErrorMessages(error.cause, seen));
  }

  return messages;
}

export async function expectRevert(
  promise: Promise<unknown>,
  expectedMessage: string
) {
  try {
    await promise;
    expect.fail(
      `Expected revert including '${expectedMessage}', but transaction succeeded`
    );
  } catch (error: any) {
    const messages = extractErrorMessages(error);
    const combinedMessage =
      messages.join(" | ") ||
      (typeof error === "string" ? error : JSON.stringify(error));
    expect(combinedMessage).to.include(expectedMessage);
  }
}
