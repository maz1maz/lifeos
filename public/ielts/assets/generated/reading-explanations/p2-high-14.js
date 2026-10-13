(function registerReadingExplanationData(global) {
  'use strict';
  if (!global.__READING_EXPLANATION_DATA__ || typeof global.__READING_EXPLANATION_DATA__.register !== "function") {
    throw new Error("reading_explanation_registry_missing");
  }
  global.__READING_EXPLANATION_DATA__.register("p2-high-14", {
  "schemaVersion": "ReadingExplanationV1",
  "examId": "p2-high-14",
  "meta": {
    "examId": "p2-high-14",
    "title": "Should space be explored by robots or by humans",
    "category": "P2",
    "sourceDoc": "source.md",
    "matchedTitle": ""
  },
  "passageNotes": [],
  "questionExplanations": []
});
})(typeof window !== "undefined" ? window : globalThis);
