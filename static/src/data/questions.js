// this is from the question set in the example quiz app resource that patrick sent to us
// we could organise questions like this for sprint 1
//
// A question object has the following shape:
//   question:      string  - the prompt shown in the header
//   clue:          string  - the excerpt / clue shown in the question box
//   options:       array   - { option: string, isCorrect: boolean }
//   hint:          string  - revealed when the player asks for a hint
//   correctAnswer: string  - shown on an incorrect answer
//
// Images (F15AAPPLE-17) are optional and do not change how a question
// behaves - a question with an image plays exactly like a text question:
//   image:  string  - an inline image URL or data URI, shown directly
//   pageId: string  - a Confluence page id; when set and `image` is
//                     absent, QuestionScreen resolves the page's first
//                     image via the getPageImages resolver at play time
// Provide at most one of `image` / `pageId`; omit both for a text question.

export const QuestionSet = [
    { // page
      question: "What page is this excerpt from? ",
      clue: "...to install ConfluenceGuessr download it from...",
      image: "https://media.giphy.com/media/dwtX3iozeZCoVcyBVu/giphy.gif",
      options:[
        { option: "Onboarding", isCorrect: false },
        { option: "Weekly Meeting 1/6/26", isCorrect: false },
        { option: "Installation documentation", isCorrect: true },
        { option: "Problem statement", isCorrect: false },
      ],
      hint: "ConfluenceGuessr is a global page confluence app and as a result it'll take up as much space as a...",
      correctAnswer: "Installation documentation. https:linktoeinstallationdocumentation",
    },
    { // space
      question: "What space is this page from? ",
      clue: "Onboarding ENG",
      image: "https://media.giphy.com/media/xUOwGj1jwTZq5Kh3Ko/giphy.gif",
      options:[
        { option: "Mobile", isCorrect: false },
        { option: "Engineering Team", isCorrect: true },
        { option: "HR", isCorrect: false },
        { option: "Legal Team", isCorrect: false },
      ],
      hint: "On the ... Team one of the first things to do is...",
      correctAnswer: "Engineering Team. https:linktoengineeringteamspace",
    },
    { // image question — image is resolved from the Confluence page at play time
      question: "What page is this image from? ",
      clue: "Which page does this diagram appear on?",
      pageId: "REPLACE_WITH_CONFLUENCE_PAGE_ID",
      options:[
        { option: "System Architecture", isCorrect: true },
        { option: "Onboarding", isCorrect: false },
        { option: "Weekly Meeting 1/6/26", isCorrect: false },
        { option: "Problem statement", isCorrect: false },
      ],
      hint: "It shows how the frontend and backend talk to each other.",
      correctAnswer: "System Architecture. https:linktosystemarchitecture",
    },
    { // section. needs clarification
      question: "What page is this exerpt from? ",
      clue: "...we received a lot of feedback for the demo despite only implementing the base game loop...",
      options:[
        { option: "Retrospective A", isCorrect: false },
        { option: "Meeting Minutes #10 Demo", isCorrect: true },
        { option: "Notes", isCorrect: false },
        { option: "Project Proposal", isCorrect: false },
      ],
      hint: "...agenda for meeting was to demo what we'd done in sprint 1.",
      correctAnswer: "Meeting Minutes #10 Demo. https:linktomeetingminutes10demo",
    },
    { // to inflate the number of questions there are
      question: "What page is this exerpt from? ",
      clue: "...Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua...",
      options:[
        { option: "A", isCorrect: false },
        { option: "B", isCorrect: true },
        { option: "C", isCorrect: false },
        { option: "D", isCorrect: false },
      ],
      hint: "...Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
      correctAnswer: "Excepteur sint occaecat",
    },
    { // to inflate the number of questions there are
      question: "What page is this exerpt from? ",
      clue: "...Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua...",
      options:[
        { option: "A", isCorrect: false },
        { option: "B", isCorrect: true },
        { option: "C", isCorrect: false },
        { option: "D", isCorrect: false },
      ],
      hint: "...Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
      correctAnswer: "Excepteur sint occaecat",
    },
    { // to inflate the number of questions there are
      question: "What page is this exerpt from? ",
      clue: "...Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua...",
      options:[
        { option: "A", isCorrect: false },
        { option: "B", isCorrect: true },
        { option: "C", isCorrect: false },
        { option: "D", isCorrect: false },
      ],
      hint: "...Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
      correctAnswer: "Excepteur sint occaecat",
    },
  ];