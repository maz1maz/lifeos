(function registerReadingExplanationData(global) {
  'use strict';
  if (!global.__READING_EXPLANATION_DATA__ || typeof global.__READING_EXPLANATION_DATA__.register !== "function") {
    throw new Error("reading_explanation_registry_missing");
  }
  global.__READING_EXPLANATION_DATA__.register("p3-low-88", {
  "schemaVersion": "ReadingExplanationV1",
  "examId": "p3-low-88",
  "meta": {
    "examId": "p3-low-88",
    "title": "1025 Translating a key to international understanding",
    "category": "P3",
    "sourceDoc": "source.md",
    "matchedTitle": ""
  },
  "passageNotes": [],
  "questionExplanations": []
});
})(typeof window !== "undefined" ? window : globalThis);