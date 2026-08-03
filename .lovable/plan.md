# Task dialogs: wider layout, clearer UI, faster editor, paste-to-attach

## 1. Dialog sizing and the stray X button

- Task **Add/Edit** dialog and **Preview (full view)** dialog currently cap at `max-w-3xl` on every screen, so on a 1500px+ monitor they look narrow. Move to a responsive ladder: `w-[95vw] sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl`. Mobile stays exactly as today (`w-[92vw]`, `max-h-[90vh]`).
- The close button floats over the title card because the dialog body scrolls under it. Fix by giving the dialog a fixed shell: header row (title + close) stays pinned at the top, body scrolls beneath it. The X gets its own reserved slot in that header row instead of being absolutely positioned over content, so it can never overlap the title block again.
- Padding/gutters increase with the width so content doesn't stretch into thin lines: content column keeps comfortable padding at `lg`/`xl`.

## 2. Visual clarity pass (no logic changes)

Within the Add/Edit form and the Preview dialog:
- Section headers (Description, Schedule, Assigned To, Attachments) get stronger contrast: `text-foreground` weight-600 labels instead of low-contrast `muted-foreground` small text, with a subtle icon chip.
- Section cards get consistent borders/background (`border-border`, `bg-card`) instead of the mixed `muted/20`, `muted/30`, `muted/40` stack that currently reads as washed out.
- Buttons: consistent height and spacing, primary action (Add/Save) visually dominant, Archive/Delete secondary/destructive but same size; on mobile they wrap into a full-width stack instead of cramped chips.
- Title, deadline and reminder text sizes bumped one step on desktop for readability. All colors use existing semantic tokens — no hardcoded colors, dark and light both verified.

## 3. Description editor performance and feel

Current editor re-creates its extension list and debounces every keystroke through the parent form state, which re-renders the whole form (including the file query and comments block) while typing. Changes:
- Keep editor content in the editor itself; publish changes to the parent through a ref + a longer debounce, so typing no longer re-renders the entire task form. Parent still reads the latest HTML on submit, so saving behaves identically.
- Memoize the toolbar and derive active states from a lightweight selection subscription rather than re-rendering the whole editor component on every transaction.
- Add the missing niceties that make it feel like ClickUp/Monday: bullet list, ordered list, headings, strike, code, blockquote, and link in the toolbar, plus markdown-style input rules (`- `, `1. `, `# `, `**bold**`) so lists and headings form as you type.
- Toolbar becomes a compact sticky bar at the top of the editor with grouped separators and active-state highlighting; editor area gets a comfortable min-height and grows instead of the current cramped fixed max-height on desktop.

## 4. Paste and drag-drop attachments

- The task form currently accepts exactly one file chosen through the file input. Extend it to a **file list**: pasted, dropped, or picked files are queued and shown as removable chips with size and type icon.
- **Paste**: pasting an image or file while focused anywhere inside the task dialog (including inside the description editor) attaches it. Pasted screenshots get a generated name like `pasted-image-<timestamp>.png`.
- **Drag & drop**: dropping files onto the form shows a highlighted drop zone and queues them.
- Existing validation (type allowlist, 5MB limit) is applied per file, unchanged. Existing single-file picker keeps working exactly as before.
- On submit, files upload sequentially to `task_attachments` and each gets a `files` row exactly like today — same bucket, same columns, same metadata.

## 5. Scope and safety

- Same treatment applied to the public-board task form (`PublicAddTaskForm`) so internal and external boards stay in parity.
- No changes to task creation/update/delete APIs, reminders, assignment, comments, realtime broadcasts, or permissions.
- Verified at 375px, 768px, 1280px and 1920px in both themes.

## Technical notes

- `src/components/ui/dialog.tsx`: no change to the shared close button; the task dialogs opt into a pinned header wrapper so the fix stays scoped to tasks.
- `src/components/TaskList.tsx`, `src/components/tasks/TaskFullView.tsx`: responsive `max-w` ladder + sticky header.
- `src/components/shared/RichTextEditor.tsx`: uncontrolled-with-ref content model, memoized toolbar, extra StarterKit marks/nodes + Link, sticky toolbar.
- New `src/components/shared/AttachmentDropzone.tsx` (chips + paste/drop handlers) used by `TaskFormFields`.
- `src/components/AddTaskForm.tsx` / `PublicAddTaskForm.tsx`: `selectedFile` becomes `selectedFiles: File[]`, upload loop replaces the single upload block.
