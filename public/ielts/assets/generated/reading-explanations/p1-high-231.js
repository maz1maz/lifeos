(function registerReadingExplanationData(global) {
  'use strict';
  if (!global.__READING_EXPLANATION_DATA__ || typeof global.__READING_EXPLANATION_DATA__.register !== "function") {
    throw new Error("reading_explanation_registry_missing");
  }
  global.__READING_EXPLANATION_DATA__.register("p1-high-231", {
  "schemaVersion": "ReadingExplanationV1",
  "examId": "p1-high-231",
  "meta": {
    "examId": "p1-high-231",
    "title": "The History of the Pencil",
    "category": "P1",
    "sourceDoc": "source.md",
    "matchedTitle": ""
  },
  "passageNotes": [],
  "questionExplanations": []
});
})(typeof window !== "undefined" ? window : globalThis);
