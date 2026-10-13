(function registerReadingExplanationData(global) {
  'use strict';
  if (!global.__READING_EXPLANATION_DATA__ || typeof global.__READING_EXPLANATION_DATA__.register !== "function") {
    throw new Error("reading_explanation_registry_missing");
  }
  global.__READING_EXPLANATION_DATA__.register("p1-high-200", {
  "schemaVersion": "ReadingExplanationV1",
  "examId": "p1-high-200",
  "meta": {
    "examId": "p1-high-200",
    "title": "Australia’s Airborne Dentists",
    "category": "P1",
    "sourceDoc": "200. P1 - Australia’s Airborne Dentists.pdf",
    "matchedTitle": "Australia’s Airborne Dentists"
  },
  "passageNotes": [],
  "questionExplanations": [
    {
      "sectionTitle": "1. True / False / Not Given (Questions 1–7)",
      "mode": "group",
      "items": [
        {
          "questionNumber": 1,
          "text": "سؤال 1: Many of the RFDS doctors work as volunteers.\nجواب: NOT GIVEN",
          "questionId": "q1"
        },
        {
          "questionNumber": 2,
          "text": "سؤال 2: RFDS dentists make trips to outback communities each month.\nجواب: FALSE",
          "questionId": "q2"
        },
        {
          "questionNumber": 3,
          "text": "سؤال 3: RFDS dentists are accompanied on their journeys to remote areas by a dental nurse.\nجواب: NOT GIVEN",
          "questionId": "q3"
        },
        {
          "questionNumber": 4,
          "text": "سؤال 4: RFDS dentists must provide a wide range of dental services.\nجواب: TRUE",
          "questionId": "q4"
        },
        {
          "questionNumber": 5,
          "text": "سؤال 5: Rural dental patients are more informed about oral hygiene than urban patients.\nجواب: FALSE",
          "questionId": "q5"
        },
        {
          "questionNumber": 6,
          "text": "سؤال 6: RFDS dentists educate patients about good eating habits.\nجواب: NOT GIVEN",
          "questionId": "q6"
        },
        {
          "questionNumber": 7,
          "text": "سؤال 7: Urban Australians generally have better teeth because their water is treated.\nجواب: TRUE",
          "questionId": "q7"
        }
      ],
      "questionRange": {
        "start": 1,
        "end": 7
      },
      "text": "سؤال \n1:: NOT GIVEN: 2:: FALSE: 3:: NOT GIVEN: 4:: TRUE: RFDS 5:: FALSE: 6:: NOT GIVEN: 7:: TRUE"
    },
    {
      "sectionTitle": "2. تکمیل یادداشت (Questions 8–13)",
      "mode": "group",
      "items": [
        {
          "questionNumber": 8,
          "text": "سؤال 8: need to bring equipment including ____ for records\nجواب: computers",
          "questionId": "q8"
        },
        {
          "questionNumber": 9,
          "text": "سؤال 9: aircraft used to carry equipment have restricted ____\nجواب: space",
          "questionId": "q9"
        },
        {
          "questionNumber": 10,
          "text": "سؤال 10: problems offering some services, e.g. fitting ____\nجواب: dentures",
          "questionId": "q10"
        },
        {
          "questionNumber": 11,
          "text": "سؤال 11: If necessary RFDS provides ____ and toothbrushes for regular use.\nجواب: toothpaste",
          "questionId": "q11"
        },
        {
          "questionNumber": 12,
          "text": "سؤال 12: If necessary RFDS provides toothpaste and ____ for regular use.\nجواب: toothbrushes",
          "questionId": "q12"
        },
        {
          "questionNumber": 13,
          "text": "سؤال 13: ____ to limit dental accidents on the sports field\nجواب: mouthguards",
          "questionId": "q13"
        }
      ],
      "questionRange": {
        "start": 8,
        "end": 13
      },
      "text": "سؤال \n8:: computers: 9:: space: 10:: dentures: 11: RFDS: toothpaste:, RFDS 12: RFDS: toothbrushes: 13:: mouthguards"
    }
  ]
});
})(typeof window !== "undefined" ? window : globalThis);
