
## Fix: Task Edit Popup Text Overflow on Mobile

### Problem
On mobile, when there's long text in the task title or description, the content overflows horizontally beyond the dialog boundaries. The text pushes the popup wider than the screen width.

### Root Cause
Three issues combine to cause the overflow:
1. The RichTextEditor's outer container and inner prose area lack `min-w-0` and `overflow-hidden` constraints, allowing long unbroken text to expand beyond bounds
2. The TaskFormFields container and sections don't enforce `min-w-0` (needed for flex/grid children to shrink below content size)
3. The title Input field doesn't have word-break constraints for long text

### Changes

**1. `src/components/shared/RichTextEditor.tsx`**
- Add `min-w-0 w-full overflow-hidden` to the outer container div
- Add `overflow-wrap: break-word` and `word-break: break-word` to the EditorContent area so long words/URLs wrap instead of overflowing
- Add `min-w-0` to the toolbar flex container

**2. `src/components/tasks/TaskFormFields.tsx`**
- Add `min-w-0 w-full overflow-hidden` to the root container div
- Add `min-w-0` to each section div so content properly shrinks within the dialog

**3. `src/components/tasks/TaskFormTitle.tsx`**
- Add `min-w-0 w-full` to the wrapper div and `overflow-hidden text-ellipsis` behavior to the Input so long titles don't push the container wider

**4. `src/components/tasks/TaskFormDescription.tsx`**
- Add `min-w-0 w-full overflow-hidden` to the wrapper div containing the RichTextEditor

These changes are CSS-only additions that constrain content to stay within its parent bounds. They won't affect desktop layout or any other components since they only add minimum-width and overflow constraints that are already naturally satisfied on wider screens.
