# App improvements and test guide

This update makes the expanded course easier to navigate while preserving accounts, lesson identifiers and progress sync.

- Course discovery: choose a track, search topics or lesson titles, filter completed/unfinished units, and jump directly to a page on web. Mobile has track selection, search and placement into later tracks.
- Lesson flow: Continue respects placement instead of sending advanced learners back to Foundations. The web completion screen offers the next playable lesson.
- Phrasebook: accent- and punctuation-tolerant search works across Tagalog, English and notes. Web results are paged in groups of 40 with letter filters and helpful empty states. Both clients report unavailable audio.
- Navigation and accessibility: labeled web navigation with the current page marked, a skip link, visible keyboard focus, loading messages, responsive controls, and reduced-motion support.
- Accounts and progress: password visibility controls, clearer goal settings, and time-based heart/day displays that refresh while the web page remains open.

## Preview checks

1. Use the course search and completion filters, then clear them. Jump to the last unit page and return.
2. Select Foundations, then use Not a beginner to start Conversational. Confirm the hero and selected track move to Conversational. Switch back to Foundations when desired.
3. Complete a lesson and use Next lesson. Check that the new lesson starts fresh and the completed lesson remains recorded.
4. Search the phrasebook for salamat or an accented spelling. Try a first-letter filter, an empty result, and audio playback.
5. Use Tab from the top of a page to skip to the main content. Check navigation, forms and lesson controls with the keyboard.
6. Show/hide a password, change a daily goal, reload, and check light/dark layouts on a phone-width screen.
7. Repeat account creation, sign-out/sign-in, and offline completion/reconnection from the [Vercel guide](VERCEL.md).

The release workflow runs the regression suites, production containers, database integration, native exports, HTTPS checks and embedded Vercel API checks. Content and deployment setup are unchanged; see [release review](RELEASE_REVIEW.md) for curriculum review scope and [Vercel setup](VERCEL.md) for deployment.
