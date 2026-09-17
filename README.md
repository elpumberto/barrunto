# Barrunto

A Chrome extension that reads what you browse, asks Jev about each thing it reads and hangs a label on it when it has something clear to say. When it is not sure, it stays quiet. *Barrunto* is Spanish for a hunch, and that is all a label is: a model's opinion, not a verdict on what was written or on whoever wrote it.

What it reads and what it says depends on the site. Everything Barrunto knows about one site is a **rule pack**, and it ships with two:

| Pack        | Reads                  | Labels                                                                                                                                      |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| X           | Posts, as you scroll   | **Bait**, made to farm reactions; **Flame**, picking a fight; **Signal**, worth your time                                                     |
| Hacker News | Comments in a thread   | **Insight**, knows the subject or was there; **Snark**, a put-down with no reasons; **Tangent**, about the title, the site or something else |

[Jev](https://docs.typesafe.ai) is TypeSafe's model that answers closed questions with probabilities instead of writing text. Barrunto asks it a handful of yes/no questions about each post or comment (nine, in the packs it ships with), in a single call, and code combines the answers into the pack's judgments. There is no server: you bring your own TypeSafe key and the extension talks straight to the API.

It is an experiment with Jev, not a product: it is not in the Chrome Web Store, and it gets things wrong.

## Installing it

Download `barrunto-chrome.zip` from the [latest release](../../releases/latest) and unzip it. In Chrome, open `chrome://extensions`, turn on developer mode, choose *Load unpacked* and pick the unzipped folder.

Or build it yourself, with Node 20 or later:

    npm install
    npm run build

and load the `.output/chrome-mv3` folder the same way. After building again, press the reload arrow on Barrunto's card; the tabs it reads pick the new build up by themselves.

## Using it

Click Barrunto's icon and paste your TypeSafe key. Then choose where it acts: **Rule packs**, at the foot of the popup, lists the packs, all off at first, and what each one does. Turning one on makes Chrome ask your leave for Barrunto to read that site, and no other; turning it off gives the leave back. Or go to the site and open the popup there: it offers that site's pack.

From then on labels turn up on their own as you read; hover over one to see what it means.

Some labels are for **noise**, the kinds of thing you may rather not see: Bait and Flame on X, Snark and Tangent on Hacker News. For each of them you choose, under *Noise* in the popup, whether what gets it is only labelled, faded, which is how they start, or hidden: all of it, author too, folded away behind a line that says so and why, with a *Show* to see it after all. What gets hidden is exactly what would have got the label, at the sensitivity you have chosen, and a model's hunch can be wrong: the line is there so that a mistake is never out of sight. When labels pull apart, as Bait and Signal on one post, the strictest wins. It looks best with items read ahead: what is judged before you reach it turns up already folded, instead of folding under your eyes.

The popup is built around the page it is opened over. The switch at the top pauses Barrunto. Then comes how that page is analyzed: its pack's **sensitivity** (on *Low* only the clear cases get a label, and each step up labels more and gets more wrong, up to *Ultra*, which labels at the faintest hunch; moving it asks Jev nothing, the answers are already there), what to do with its noise, how many items it reads ahead of you, and tuning mode. Last, what goes on with Jev: how much has been analyzed and the tokens that took, and the key.

**Tuning mode** puts under each post or comment one line with how each judgment came out; click it and it unfolds what Jev answered to every question and how each judgment added up. It is the way to see why something got the label it got, and the tool for adjusting the questions and the recipes.

The icon in the toolbar is in colour while Barrunto reads, grey while it is paused, has no key or has no pack on, and carries a `!` when the key is rejected or Jev is failing.

## How it decides

1. **It reads what is on the page, and a little ahead of you.** What shows on screen is analyzed at once, and so are the next three items past it, so that their labels are there by the time you are; if you get there first, a small mark says Jev is being asked, and that item goes ahead of the ones read ahead. How many items are read ahead is **Read ahead** in the popup. Every one of them is paid for, read or not: with 0, a post or a comment is analyzed only once it has stayed on screen for a moment, not if it flies past. What a pack has no business reading is left alone: ads, posts from protected accounts, comments that were flagged.
2. **It asks Jev once per item.** One call carries the item and the pack's yes/no questions, each about one **trait**: does it explicitly ask for a reaction, does it attack someone, does the author show working knowledge of the subject, does the reader learn something from it… Each comes back as the probability of a yes.
3. **Code combines.** Each judgment has a **recipe**: a list of traits and of signals read off the page (such as many replies for few likes), each with a weight that pushes it or holds it back. An answer counts only when Jev is reasonably sure of it: a lukewarm answer is Jev not knowing, and it weighs nothing. Out of the recipe comes the judgment's **strength**, from 0 to 1.
4. **It labels or stays quiet.** A label goes up if the strength clears the threshold of the pack's current sensitivity. The answers are kept for the session, so changing the sensitivity asks Jev nothing.

The X.com recipes were tuned against real posts. The Hacker News ones say what they intend and are yet to be tuned the same way: expect them to move.

## What leaves your browser

What Barrunto reads on the sites whose pack is on goes to `api.typesafe.ai`, with your key, and nowhere else. That is what shows on screen and, with Read ahead, the next few items below it, seen or not. On X.com it is the text of each post, its author and its counts, whether it carries media, a link or is part of a thread and, if it quotes another post, that post's author and text. On Hacker News it is the words of each comment, the story's title and text, and the words of the comment it answers: nobody's name. The key is stored only in your browser, as it is, the way extensions store things. Barrunto makes no requests to the sites it reads: it reads the page you already have, and it cannot read a site whose pack is off, because Chrome holds no leave for it. A site's own scripts can see that Barrunto is there and what it labelled.

A post can be written to argue with its judge. A label, or its absence, is a hunch, and an author can try to game it.

Barrunto uses TypeSafe's SDK with `dangerouslyAllowBrowser` turned on, which the SDK asks for so that nobody ships a website with their own key inside. Here the key is each user's own, and it is used from the extension's background, never from a page: the storage it is kept in is closed to the part of the extension that runs inside the sites it reads.

## How the code is organised

Everything specific to a site lives together as a **rule pack**, apart from an **engine** that knows nothing about any site or about Chrome. The parts of the extension are thin: they connect the engine with the page, with Jev and with storage, and work with whatever packs there are.

| Where               | What                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine`        | The types, among them the shape of a pack; computing strengths from answers and recipes, deciding which labels apply and what is done to noise, what a pack is like until the user changes it, the call queue |
| `src/packs`         | One folder per pack, the list of them in `index.ts` and the list of their page halves in `pages.ts`                                           |
| `src/jev`           | The only piece that knows TypeSafe's SDK, and a stand-in that makes answers up                                                                |
| `src/storage`       | What is stored, where, with its types                                                                                                         |
| `src/messages.ts`   | The four things the parts ask the background, with their types                                                                                |
| `src/entrypoints`   | The content script (watches a page and paints), the background (asks Jev, keeps the answers, has the content script run where a pack is on) and the popup |

A pack has two halves, because one runs inside the page and the other does not:

| In a pack's folder | What                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`         | Who it is: its name, the sites it acts on, the controls it puts in front of the user, its rules                                                               |
| `rules/`           | The questions for Jev, the page signals, the judgments with their recipes and thresholds, the labels, and how an item is put in front of Jev                  |
| `page/`            | Where things are on the site's page and how an item is read, where its labels go, what of it is faded or hidden, and what else is done to it. When the site changes, `selectors.ts` is the fix |

Who may import whom is kept by lint rules in `eslint.config.js`: the engine and the packs do not know Chrome, the engine and a pack's rules do not know the page either, a pack does not know another, only `src/jev` knows the SDK, only the content script takes the page halves, and it cannot reach the key. `src/borders.test.ts` checks that those rules still bite.

To change what Barrunto looks for on a site, the place is the pack's `rules`: a question in `traits.ts`, a weight in `judgments.ts`. The tests in `judgments.test.ts` are the kinds of item the recipes are meant for.

To write a pack for another site, copy the simpler one, `src/packs/hn`, add it to the two lists in `src/packs`, and the rest follows from there: the manifest asks for its sites as optional, the popup lists it, the content script runs on it once it is on. `src/packs/packs.test.ts` checks that it holds together.

## Working on it

| Command                  | What it does                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `npm run dev`            | Opens a Chrome of its own with the extension, reloading it on every change                |
| `npm run build:stand-in` | Builds with the stand-in in place of Jev: any key works and nothing is spent. It holds leave for every pack's site from the start |
| `npm test`               | The tests of the engine, each pack's recipes and reading of its page, Jev, storage and the parts    |
| `npm run smoke`          | Loads the built extension into a headless Chrome and walks the whole path once            |
| `npm run check`, `lint`  | Types, ESLint with the borders between pieces, Prettier                                   |
| `npm run verify`         | All of the above, then the build                                                          |
| `npm run zip`            | The archive that goes in a release                                                        |

Built with [WXT](https://wxt.dev) and TypeScript, with no UI framework. The wordmark is set in [Bricolage Grotesque](https://github.com/ateliertriay/bricolage), under the SIL Open Font License.

## Licence

[MIT](LICENSE).
