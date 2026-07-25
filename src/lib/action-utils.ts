export function getFriendlyErrorMessage(err: unknown): string {
  if (!err) return "An unexpected error occurred.";

  let message = "";
  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "object" && err !== null && "message" in err) {
    message = String((err as any).message);
  } else if (typeof err === "string") {
    message = err;
  }

  if (message) {
    const lower = message.toLowerCase();
    if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
      return "This record already exists. Please check for duplicates.";
    }
    if (lower.includes("foreign key") || lower.includes("violates foreign key")) {
      return "This record is linked to other items and cannot be modified or deleted directly.";
    }
    if (lower.includes("not null constraint")) {
      return "A required field is missing.";
    }
    if (lower.includes("column") && lower.includes("does not exist")) {
      return "Database schema column missing. Applied automatic patch, please try again.";
    }
    if (lower.includes("unauthorized") || lower.includes("not authenticated")) {
      return "You must be logged in to perform this action.";
    }
    return message;
  }

  return "An unexpected error occurred.";
}
