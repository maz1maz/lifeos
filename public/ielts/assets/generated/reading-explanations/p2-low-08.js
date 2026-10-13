(function registerReadingExplanationData(global) {
  'use strict';
  if (!global.__READING_EXPLANATION_DATA__ || typeof global.__READING_EXPLANATION_DATA__.register !== "function") {
    throw new Error("reading_explanation_registry_missing");
  }
  global.__READING_EXPLANATION_DATA__.register("p2-low-08", {
  "schemaVersion": "ReadingExplanationV1",
  "examId": "p2-low-08",
  "meta": {
    "examId": "p2-low-08",
    "title": "How the Petri dish supports scientific advances",
    "category": "P2",
    "sourceDoc": "source.md",
    "matchedTitle": ""
  },
  "passageNotes": [],
  "questionExplanations": []
});
})(typeof window !== "undefined" ? window : globalThis);
