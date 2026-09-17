# Barrunto

A Chrome extension that reads posts on X.com as you browse, asks Jev about each one and hangs a label on it when it has something clear to say: that it is **Bait**, made to farm reactions; that it is **Flame**, picking a fight; or that it is **Signal**, worth your time. When it is not sure, it stays quiet. *Barrunto* is Spanish for a hunch, and that is all a label is: a model's opinion, not a verdict on the post or on whoever wrote it.

[Jev](https://docs.typesafe.ai) is TypeSafe's model that answers closed questions with probabilities instead of writing text. Barrunto asks it nine yes/no questions about each post, in a single call, and code combines the answers into the three judgments. There is no server: you bring your own TypeSafe key and the extension talks straight to the API.

It is an experiment with Jev, not a product: it is not in the Chrome Web Store, and it gets things wrong.

## Installing it

Download `barrunto-chrome.zip` from the [latest release](../../releases/latest) and unzip it. In Chrome, open `chrome://extensions`, turn on developer mode, choose *Load unpacked* and pick the unzipped folder.

Or build it yourself, with Node 20 or later:

    npm install
    npm run build

and load the `.output/chrome-mv3` folder the same way. After building again, press the reload arrow on Barrunto's card and reload the X.com tab.

## Using it

Click Barrunto's icon, paste your TypeSafe key and open X.com. Labels turn up on their own as you scroll; hover over one to see what it means.

In the popup you can pause it, see how many posts it has analyzed and how many tokens that took, and move the **sensitivity**: on *Low* only the clear cases get a label, and each step up labels more and gets more wrong, up to *Ultra*, which labels at the faintest hunch. Moving it asks Jev nothing: the answers are already there.

**Tuning mode** shows under each post what Jev answered to every question and how each judgment added up. It is the way to see why a post got the label it got, and the tool for adjusting the questions and the recipes.

The icon in the toolbar is in colour while Barrunto reads, grey while it is paused or has no key, and carries a `!` when the key is rejected or Jev is failing.

## How it decides

1. **It reads what is on the page.** A post is analyzed once it has stayed on screen for a moment, not if it flies past. Ads, posts with no text and posts from protected accounts are left alone.
2. **It asks Jev once per post.** One call carries the post and nine yes/no questions, each about one **trait**: does it explicitly ask for a reaction, is it a question thrown at the crowd to collect replies, does it attack someone, does the reader learn something from it… Each comes back as the probability of a yes.
3. **Code combines.** Each judgment has a **recipe**: a list of traits and of signals read off the page (such as many replies for few likes), each with a weight that pushes it or holds it back. An answer counts only when Jev is reasonably sure of it: a lukewarm answer is Jev not knowing, and it weighs nothing. Out of the recipe comes the judgment's **strength**, from 0 to 1.
4. **It labels or stays quiet.** A label hangs if the strength clears the threshold of the current sensitivity. The answers are kept for the session, so changing the sensitivity, or a weight while tuning, asks Jev nothing.

## What leaves your browser

The text of each post you dwell on, its author and its counts go to `api.typesafe.ai`, with your key, and nowhere else; so do whether it carries media, a link or is part of a thread and, if it quotes another post, that post's author and text. Posts from protected accounts are left alone. The key is stored only in your browser, as it is, the way extensions store things. Barrunto makes no requests to X.com: it reads the page you already have. X.com's own scripts can see that Barrunto is there and what it labelled.

A post can be written to argue with its judge. A label, or its absence, is a hunch, and an author can try to game it.

Barrunto uses TypeSafe's SDK with `dangerouslyAllowBrowser` turned on, which the SDK asks for so that nobody ships a website with their own key inside. Here the key is each user's own, and it is used from the extension's background, never from the X.com page: the storage it is kept in is closed to the part of the extension that runs inside X.com's tab.

## How the code is organised

Everything specific to X.com lives together as a **rule pack**, apart from an **engine** that knows nothing about X.com or Chrome. The three parts of the extension are thin: they connect the engine with the page, with Jev and with storage.

| Where                 | What                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/engine`          | The types, computing strengths from answers and recipes, deciding which labels apply, the call queue        |
| `src/packs/x/rules`   | The questions for Jev, the page signals, the three judgments with their recipes and thresholds, the labels  |
| `src/packs/x/page`    | Where things are on X.com's page and how a post is read. When X.com changes, `selectors.ts` is the fix      |
| `src/jev`             | The only piece that knows TypeSafe's SDK, and a stand-in that makes answers up                              |
| `src/storage`         | What is stored, where, with its types                                                                       |
| `src/messages.ts`     | The four things the parts ask the background, with their types                                              |
| `src/entrypoints`     | The content script (watches X.com and paints), the background (asks Jev, keeps the answers) and the popup   |

Who may import whom is kept by lint rules in `eslint.config.js`: the engine and the pack do not know Chrome, only `src/jev` knows the SDK, and the script that runs inside X.com's tab cannot reach the key.

To change what Barrunto looks for, the place is `src/packs/x/rules`: a question in `traits.ts`, a weight in `judgments.ts`. The tests in `judgments.test.ts` are the kinds of post the recipes were tuned on.

## Working on it

| Command                  | What it does                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `npm run dev`            | Opens a Chrome of its own with the extension, reloading it on every change                |
| `npm run build:stand-in` | Builds with the stand-in in place of Jev: any key works and nothing is spent              |
| `npm test`               | The tests of the engine, the recipes, the reading of X.com's page, Jev, storage and the three parts |
| `npm run smoke`          | Loads the built extension into a headless Chrome and walks the whole path once            |
| `npm run check`, `lint`  | Types, ESLint with the borders between pieces, Prettier                                   |
| `npm run verify`         | All of the above, then the build                                                          |
| `npm run zip`            | The archive that goes in a release                                                        |

Built with [WXT](https://wxt.dev) and TypeScript, with no UI framework. The wordmark is set in [Bricolage Grotesque](https://github.com/ateliertriay/bricolage), under the SIL Open Font License.

## Licence

[MIT](LICENSE).
