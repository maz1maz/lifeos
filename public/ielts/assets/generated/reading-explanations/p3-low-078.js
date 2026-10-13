(function registerReadingExplanationData(global) {
  'use strict';
  if (!global.__READING_EXPLANATION_DATA__ || typeof global.__READING_EXPLANATION_DATA__.register !== "function") {
    throw new Error("reading_explanation_registry_missing");
  }
  global.__READING_EXPLANATION_DATA__.register("p3-low-078", {
  "schemaVersion": "ReadingExplanationV1",
  "examId": "p3-low-078",
  "meta": {
    "examId": "p3-low-078",
    "title": "P3 (ds) - Music Language We All Speak",
    "category": "P3",
    "sourceDoc": "source.md",
    "matchedTitle": ""
  },
  "passageNotes": [],
  "questionExplanations": []
});
})(typeof window !== "undefined" ? window : globalThis);
