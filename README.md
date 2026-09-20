# Barrunto

A Chrome extension that reads what you browse, asks Jev about each thing it reads and hangs a label on it when it has something clear to say. When it is not sure, it stays quiet. *Barrunto* is Spanish for a hunch, and that is all a label is: a model's opinion, not a verdict on what was written or on whoever wrote it.

What it reads and what it says depends on the site. Everything Barrunto knows about one thing to do on one site is a **rule pack**, and it ships with three:

| Pack          | Reads                     | Labels                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X Posts       | Posts on X, as you scroll | **Bait**, made to farm reactions; **Flame**, picking a fight; **Signal**, worth your time                                                                                                                                                                                   |
| Jetective Jev | The profile you open on X | A case file on the account: whether it looks **Automated**, like a **Scam**, a **Billboard** or a **Farm** of reactions; or like a **Maker** who shows what they make, a **Pro** who knows their trade or a **Regular** account of somebody's; with the evidence either way |
| Hacker News   | Comments in a thread      | **Insight**, knows the subject or was there; **Snark**, a put-down with no reasons; **Tangent**, about the title, the site or something else                                                                                                                                |

[Jev](https://docs.typesafe.ai) is TypeSafe's model that answers closed questions with probabilities instead of writing text. Barrunto asks it a handful of closed questions about each post, comment or profile (nine yes/no ones about a post or a comment; of a profile, seven, and of what kind each of its posts is), in a single call, and code combines the answers into the pack's judgments. There is no server: you bring your own TypeSafe key and the extension talks straight to the API.

It is an experiment with Jev, not a product: it is not in the Chrome Web Store, and it gets things wrong.

## Installing it

Download `barrunto-chrome.zip` from the [latest release](../../releases/latest) and unzip it. In Chrome, open `chrome://extensions`, turn on developer mode, choose *Load unpacked* and pick the unzipped folder.

Or build it yourself, with Node 22 or later:

    npm install
    npm run build

and load the `.output/chrome-mv3` folder the same way. Its name starts with a dot, so the window that picks a folder may hide it: Ctrl+H shows it on Linux, Cmd+Shift+. on a Mac. What each version brings, and what to do after updating to it, is in the [changelog](CHANGELOG.md). After building again, press the reload arrow on Barrunto's card; the tabs it reads pick the new build up by themselves.

## Using it

Click Barrunto's icon and paste your TypeSafe key. Then choose where it acts: **Rule packs**, at the foot of the popup, lists the packs, all off at first, and what each one does. Turning one on makes Chrome ask your leave for Barrunto to read that site, and no other; turning it off gives the leave back. Two packs act on X.com, each turned on and off by itself: Chrome asks once for the site, and the leave goes back with the last of them. Or go to the site and open the popup there: it offers that site's packs, and where there are two their names, at the top of the block, are the way from one to the other.

From then on labels turn up on their own as you read; hover over one to see what it means.

Some labels are for **noise**, the kinds of thing you may rather not see: Bait and Flame on X's posts, Snark and Tangent on Hacker News. For each of them you choose, under *Noise* in the popup, whether what gets it is only labelled, faded, which is how they start, or hidden: all of it, author too, folded away behind a line that says so and why, with a *Show* to see it after all. What gets hidden is exactly what would have got the label, at the sensitivity you have chosen, and a model's hunch can be wrong: the line is there so that a mistake is never out of sight. When labels pull apart, as Bait and Signal on one post, the strictest wins. It looks best with items read ahead: what is judged before you reach it turns up already folded, instead of folding under your eyes.

The popup is built around the page it is opened over. The switch at the top pauses Barrunto. Then comes how that page is analyzed: its pack's **sensitivity** (on *Low* only the clear cases get a label, and each step up labels more and gets more wrong, up to *Ultra*, which labels at the faintest hunch; moving it asks Jev nothing, the answers are already there), what to do with its noise, how many items it reads ahead of you, where it reads items, and tuning mode. Last, what goes on with Jev: how much has been analyzed and the tokens that took, and the key.

With X Posts on, Barrunto also reads **what you write** before you post it. Once you stop typing for a moment, it asks Jev the same questions it asks of anybody's post and tells you, under the box, which labels your post may get and how readers would have to set their sensitivity to see each: *even at Low*, *from Medium*, *from High*, *only at Ultra*. A reply or a quote is read on its own, without the post it answers, so a hunch about one is worth less. It is for you alone, it changes nothing of what you post, and every check is a call, paid like any other. *Check my drafts* in the popup turns it off.

**Jetective Jev** works on profiles alone. Open one, your own too, and over its tabs a case file turns up, numbered, stamped and signed: what the page says of the subject (since when it is on file, whom it follows, how much it posts), what the account looks like, how strong the hunch is and, always, the exhibits for and against: which of the things it looked for were there. It judges what an account does, which anyone can see, never who is behind it. Jev is asked of each post what kind of post it is (the author's own things, something they made, a remark that would fit anywhere, an advert, a promise of money, a plea for reactions, stock material that goes round) and code counts: an exhibit reads *7 of 12 posts read as adverts*, which you can check. Showing what one has made is not selling it: it counts for the account, not against it. Every line of the file is a sentence from the code, picked by code: Jev writes none of it. It says *looks like*, never *is*; with nothing clear it says so; and no label of this pack is noise, so nobody is faded or hidden for what their account looks like. Protected accounts are left alone, and so are ones that are not there. X.com keeps on the page only the posts near what is on screen: the file is opened with the few there are, and as you go down the profile Jev takes another look each time it has shown half a dozen more, up to thirty posts.

**Tuning mode** puts under each post, comment or case file one line with how each judgment came out (of a pack with many, the ones that got a label and the strongest of the rest); click it and it unfolds what Jev answered to every question and how each judgment added up, with what came to nothing named in a line and not given a row each. It is the way to see why something got the label it got, and the tool for adjusting the questions and the recipes.

The icon in the toolbar is in colour while Barrunto reads, grey while it is paused, has no key or has no pack on, and carries a `!` when the key is rejected or Jev is failing.

## How it decides

1. **It reads what is on the page, and a little ahead of you.** What shows on screen is analyzed at once, and so are the next three items past it, so that their labels are there by the time you are; if you get there first, a small mark says Jev is being asked, and that item goes ahead of the ones read ahead. How many items are read ahead is **Read ahead** in the popup. Every one of them is paid for, read or not: with 0, a post or a comment is analyzed only once it has stayed on screen for a moment, not if it flies past. What a pack has no business reading is left alone: ads, posts from protected accounts, comments that were flagged. A pack that reads one thing per page, as Jetective Jev reads a profile, asks once it has enough to go by, or once the page has stopped filling in, and again as the page goes on to show more.
2. **It asks Jev once per item.** One call carries the item and the pack's questions, each about one **trait**, yes/no as a rule: does it explicitly ask for a reaction, does it attack someone, does the author show working knowledge of the subject, does the reader learn something from it… Each comes back as the probability of a yes. A trait may instead ask which of a few kinds a part of the item is, as each post of a profile, and comes back as the chance of each kind.
3. **Code combines.** Each judgment has a **recipe**: a list of traits and of signals that code works out (from the page, such as many replies for few likes or how long ago an account was opened; or by counting Jev's answers, such as how much of what an account posts is adverts), each with a weight that pushes it or holds it back. An answer counts only when Jev is reasonably sure of it: a lukewarm answer is Jev not knowing, and it weighs nothing. Out of the recipe comes the judgment's **strength**, from 0 to 1.
4. **It labels or stays quiet.** A label goes up if the strength clears the threshold of the pack's current sensitivity. The answers are kept for the session, so changing the sensitivity asks Jev nothing.

The X.com recipes were tuned against real posts. The Hacker News ones have had a first tuning against real threads, and Jetective Jev's have had a first look at a handful of real profiles: expect them to move. In Jetective Jev's, what an account is like (how new, how its handle is made, how many it follows) only ever adds to what it does: all of it together is not enough for a charge. It takes more to speak ill of an account than to speak well of it, more still with few posts to go by, and no two charges count the same thing.

## What leaves your browser

What Barrunto reads on the sites whose pack is on goes to `api.typesafe.ai`, with your key, and nowhere else. That is what shows on screen and, with Read ahead, the next few items below it, seen or not. On X.com it is the text of each post, its author and its counts, whether it carries media, a link or is part of a thread and, if it quotes another post, that post's author and text. With Jetective Jev on, it is, of each profile you open, the name shown, the bio and the words of the account's own posts that the page has shown, up to thirty of them, when you open the profile and again each time going down it has shown half a dozen more: not the handle, whose shape code looks at, nor the counts or the date it was opened, which code weighs without asking anyone. With *Check my drafts* on, it is also what you are writing there, each time you stop typing, posted or not: the words and whether they carry media, a link or are part of a thread, and not who you are. On Hacker News it is the words of each comment, the story's title and text, and the words of the comment it answers: nobody's name. The key is stored only in your browser, as it is, the way extensions store things. Barrunto makes no requests to the sites it reads: it reads the page you already have, and it cannot read a site whose pack is off, because Chrome holds no leave for it. A site's own scripts can see that Barrunto is there and what it labelled.

A post can be written to argue with its judge. A label, or its absence, is a hunch, and an author can try to game it.

Barrunto uses TypeSafe's SDK with `dangerouslyAllowBrowser` turned on, which the SDK asks for so that nobody ships a website with their own key inside. Here the key is each user's own, and it is used from the extension's background, never from a page: the storage it is kept in is closed to the part of the extension that runs inside the sites it reads.

## How the code is organised

Everything specific to a site lives together as a **rule pack**, apart from an **engine** that knows nothing about any site or about Chrome. The parts of the extension are thin: they connect the engine with the page, with Jev and with storage, and work with whatever packs there are.

| Where               | What                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine`        | The types, among them the shape of a pack; computing strengths from answers and recipes, deciding which labels apply and what is done to noise, what a pack is like until the user changes it, the call queue |
| `src/packs`         | One folder per pack, the list of them in `index.ts` and the lists of their page halves in `pages.ts`                                          |
| `src/jev`           | The only piece that knows TypeSafe's SDK, and a stand-in that makes answers up                                                                |
| `src/storage`       | What is stored, where, with its types                                                                                                         |
| `src/messages.ts`   | The four things the parts ask the background, with their types                                                                                |
| `src/entrypoints`   | The content script (watches a page and paints), the background (asks Jev, keeps the answers, has the content script run where a pack is on) and the popup |

A pack has two halves, because one runs inside the page and the other does not:

| In a pack's folder | What                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`         | Who it is: its name, what it is for, the sites it acts on, its rules and, if it shows a card, the words of it                                                 |
| `rules/`           | The questions for Jev, the page signals, the judgments with their recipes and thresholds, the labels, and how an item is put in front of Jev                  |
| `page/`            | Where things are on the site's page and how an item is read, where its labels go, what of it is faded or hidden and, if the pack reads what you write there, where that is. Or, for a pack that reads one thing per page: which pages those are, how the thing is read, when there is enough of it to ask, and where its card goes. When the site changes, `selectors.ts` is the fix |

Who may import whom is kept by lint rules in `eslint.config.js`: the engine and the packs do not know Chrome, the engine and a pack's rules do not know the page either, a pack does not know another, only `src/jev` knows the SDK, only the content script takes the page halves, and it cannot reach the key. `src/borders.test.ts` checks that those rules still bite.

To change what Barrunto looks for on a site, the place is the pack's `rules`: a question in `traits.ts`, a weight in `judgments.ts`. The tests in `judgments.test.ts` are the kinds of item the recipes are meant for.

A page half says where things are and never paints: painting is the content script's, in nodes of its own that the page's styles cannot reach. That goes for a card too: its words are the pack's, in `card.ts`, and the panel that shows them knows no pack.

To write a pack for another site, copy the simpler one, `src/packs/hn`, add it to the two lists in `src/packs`, and the rest follows from there: the manifest asks for its sites as optional, the popup lists it, the content script runs on it once it is on. A pack may share its site with another, as `src/packs/jetective` does with `src/packs/x`: each gets a watcher of its own on the page. `src/packs/packs.test.ts` checks that it holds together.

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

A release is a tag: set the version in `package.json`, give it a section at the top of `CHANGELOG.md`, and push `v` and the version as a tag. The release is built from it, with that section as its notes.

Built with [WXT](https://wxt.dev) and TypeScript, with no UI framework. The wordmark is set in [Bricolage Grotesque](https://github.com/ateliertriay/bricolage), under the SIL Open Font License.

## Licence

[MIT](LICENSE). The built extension carries the notices of the packages bundled in it, in `THIRD-PARTY-NOTICES.txt`; `npm run notices` writes it again when one of them changes.
