import { useEditor, EditorContent, Editor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { Button } from '../ui/button';
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Heading2,
  Quote,
  Code,
  Link as LinkIcon,
  Palette,
  Smile,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import debounce from 'lodash/debounce';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

const COLORS: [string, string][] = [
  ['#FF4E32', 'Red'],
  ['#08B531', 'Green'],
  ['#335CF4', 'Blue'],
  ['#F59E0B', 'Amber'],
  ['#A855F7', 'Purple'],
  ['#0EA5E9', 'Cyan'],
];

const ToolbarButton = ({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    title={label}
    aria-label={label}
    aria-pressed={!!active}
    onMouseDown={(e) => e.preventDefault()}
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={cn(
      'h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
      active && 'bg-primary/15 text-primary hover:bg-primary/20'
    )}
  >
    {children}
  </Button>
);

const Divider = () => <span className="mx-0.5 h-5 w-px self-center bg-border" aria-hidden />;

/** Toolbar is isolated so typing does not re-render the editor tree. */
const EditorToolbar = memo(function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link')?.href as string | undefined;
    const url = window.prompt('Link URL', previous || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }, [editor]);

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1 backdrop-blur supports-[backdrop-filter]:bg-muted/30 min-w-0">
      <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label="Heading 1" active={state.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label="Bullet list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Checklist" active={state.taskList} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Inline code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Link" active={state.link} onClick={setLink}>
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Text color"
            aria-label="Text color"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 bg-popover border-border p-2">
          <div className="grid grid-cols-3 gap-2">
            {COLORS.map(([color, name]) => (
              <button
                key={color}
                type="button"
                title={name}
                aria-label={name}
                className="h-7 w-full rounded-md border border-border transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
                onClick={(e) => {
                  e.preventDefault();
                  editor.chain().focus().setColor(color).run();
                }}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={(e) => {
              e.preventDefault();
              editor.chain().focus().unsetColor().run();
            }}
          >
            Reset color
          </Button>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Emoji"
            aria-label="Emoji"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover border-border">
          <Picker
            data={data}
            onEmojiSelect={(emoji: any) => {
              editor.chain().focus().insertContent(emoji.native).run();
            }}
          />
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-0.5">
        <ToolbarButton label="Undo" active={false} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className={cn('h-4 w-4', !state.canUndo && 'opacity-40')} />
        </ToolbarButton>
        <ToolbarButton label="Redo" active={false} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className={cn('h-4 w-4', !state.canRedo && 'opacity-40')} />
        </ToolbarButton>
      </div>
    </div>
  );
});

const RichTextEditor = memo(function RichTextEditor({
  content,
  onChange,
  onBlur,
  placeholder,
  className,
}: RichTextEditorProps) {
  const prevContentRef = useRef(content);
  const isUserEditingRef = useRef(false);
  // Keep the latest onChange without recreating the debounced fn
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const debouncedOnChange = useMemo(
    () =>
      debounce((html: string) => {
        if (isUserEditingRef.current) {
          onChangeRef.current(html);
        }
      }, 400),
    []
  );

  const extensions = useMemo(
    () =>
      [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        TaskList.configure({ HTMLAttributes: { class: 'not-prose pl-1' } }),
        TaskItem.configure({ nested: true, HTMLAttributes: { class: 'flex items-start gap-2 my-1.5' } }),
        TextStyle,
        Color,
        Underline,
        Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-primary underline underline-offset-2' } }),
        placeholder
          ? Placeholder.configure({ placeholder, emptyEditorClass: 'is-editor-empty' })
          : null,
      ].filter(Boolean),
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content,
    // Big perf win: do not re-render this React tree on every transaction
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== prevContentRef.current) {
        isUserEditingRef.current = true;
        prevContentRef.current = html;
        debouncedOnChange(html);
      }
    },
    onBlur: () => {
      // Flush pending changes immediately on blur so nothing is lost
      debouncedOnChange.flush();
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[140px]',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== prevContentRef.current && !isUserEditingRef.current) {
      const selection = editor.state.selection;
      editor.commands.setContent(content, false);
      prevContentRef.current = content;
      if (editor.isFocused) {
        editor.commands.setTextSelection(selection);
      }
    }
    isUserEditingRef.current = false;
  }, [content, editor]);

  useEffect(() => {
    return () => {
      debouncedOnChange.flush();
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  if (!editor) {
    return (
      <div className={cn('border border-input rounded-lg min-h-[180px] bg-background animate-pulse', className)} />
    );
  }

  return (
    <div
      className={cn(
        'border border-input rounded-lg min-w-0 w-full overflow-hidden bg-background focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-colors',
        className
      )}
    >
      <EditorToolbar editor={editor} />
      <div
        className="cursor-text max-h-[35vh] sm:max-h-[45vh] overflow-y-auto"
        onClick={() => {
          if (!editor.isFocused) editor.commands.focus();
        }}
      >
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert max-w-none p-3 sm:p-4 min-w-0 [&_.ProseMirror]:break-words [&_.ProseMirror]:[overflow-wrap:break-word] [&_.ProseMirror]:[word-break:break-word] [&_.ProseMirror]:min-h-[140px] [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_ul]:my-1.5 [&_.ProseMirror_ol]:my-1.5"
        />
      </div>
    </div>
  );
});

export { RichTextEditor };
