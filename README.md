# SVU Quiz

Arabic-first static quiz app for SVU study questions. It can load built-in subject files from remote links or import a local JSON file, then turn the data into an interactive timed quiz with progress saving, review tools, and shareable results.

Live repository: https://github.com/shadi-almilhem/svu-quiz

## Features

- RTL Arabic interface with IBM Plex Sans Arabic.
- Direct subject picker with remote JSON loading and fallback URLs.
- Local JSON import for custom quizzes.
- One-question-at-a-time quiz flow.
- Single-answer and multi-answer question support.
- 30-second timer per question with pause/resume.
- Keyboard shortcuts for navigation, answer selection, and timer pause.
- Progress bar and chapter progress every 50 questions.
- Chapter motivation banners and completion celebrations.
- Milestone celebrations while answering long quizzes.
- Optional instant feedback after each answer.
- Saved progress in `localStorage` for 7 days.
- Bookmarked questions with a saved-questions results section.
- Results summary with score, answered count, unanswered count, and wrong count.
- Review tabs for unanswered and wrong questions.
- Retry mode for incorrect and unanswered questions.
- Recent score history, keeping the latest 10 attempts.
- Share-result button that creates a PNG result card.
- Minimal visitor counter badge in the footer.
- GitHub repository link in the footer.
- SVG favicon and social metadata.

## Project Structure

```text
.
├── index.html
├── styles.css
├── script.js
├── favicon.svg
├── README.md
└── .gitignore
```

The repository does not include quiz JSON data files. Users can load the built-in remote subjects from the app or upload their own JSON files.

## Running Locally

Because the app fetches files and external scripts, use a small local server instead of opening `index.html` directly:

```bash
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/index.html
```

No package install or build step is required.

## JSON File Format

The app expects a JSON object with a `messages` array. Each item that contains a `poll` object becomes one quiz question.

Each `poll` needs:

- `question`: the question text.
- `answers`: an array of answer choices.

Each answer needs:

- `text`: the answer text.
- `chosen`: `true` for a correct answer, `false` for an incorrect answer.

The app also accepts `correct: true` as an alternative to `chosen: true`.

## Complete JSON Example

```json
{
  "messages": [
    {
      "poll": {
        "question": "ما الهدف من تنظيف البيانات؟",
        "answers": [
          {
            "text": "تحسين جودة البيانات قبل التحليل",
            "chosen": true
          },
          {
            "text": "حذف جميع البيانات",
            "chosen": false
          },
          {
            "text": "تغيير أسماء الملفات فقط",
            "chosen": false
          }
        ]
      }
    },
    {
      "poll": {
        "question": "أي من الخيارات التالية تعد من أنواع التصورات البيانية؟",
        "answers": [
          {
            "text": "المخطط العمودي",
            "chosen": true
          },
          {
            "text": "المخطط الخطي",
            "chosen": true
          },
          {
            "text": "ضغط الملفات",
            "chosen": false
          }
        ]
      }
    }
  ]
}
```

The second example has two correct answers, so the app will render it as a multi-select question.

## JSON Rules

- Use valid JSON syntax.
- Put commas between array items and object properties.
- Use double quotes around property names and strings.
- Keep at least two answers per question.
- Use up to nine answers if you want keyboard shortcuts `1` through `9` to map cleanly.
- Mark one or more answers as correct with `"chosen": true`.
- If no answer is marked correct, the app cannot score that question properly.

## LocalStorage Keys

The app stores user-side progress only in the browser:

- `quizProgress`: active quiz state, answers, bookmarks, retry queue, and settings.
- `chapterProgress`: chapter completion state.
- `quizScoreHistory`: latest 10 score summaries.

No backend database is required.

## Deployment

This is a static site. It can be deployed to GitHub Pages, Vercel, Netlify, Cloudflare Pages, or any static host.

If deploying on GitHub Pages, publish the root folder from the `main` branch.
