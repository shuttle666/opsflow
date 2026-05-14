type StructuredLogLevel = "debug" | "info" | "warn" | "error";

type StructuredLogEntry = {
  level: StructuredLogLevel;
  message: string;
  [key: string]: unknown;
};

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    type: "UnknownError",
    message: String(error),
  };
}

export function writeStructuredLog(entry: StructuredLogEntry) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const serialized = JSON.stringify(payload);

  switch (entry.level) {
    case "debug":
    case "info":
      console.info(serialized);
      return;
    case "warn":
      console.warn(serialized);
      return;
    case "error":
      console.error(serialized);
      return;
  }
}
