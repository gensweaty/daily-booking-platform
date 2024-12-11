import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import { Button } from '../ui/button';
import { Bold, Underline as UnderlineIcon, List, Type, Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { memo, useEffect, useMemo, useRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
}

const RichTextEditor = memo(function RichTextEditor({ content, onChange, onBlur }: RichTextEditorProps) {
  const prevContentRef = useRef(content);
  const shouldUpdateRef = useRef(false);
  const selectionRef = useRef<{ from: number; to: number } | null>(null);

  const extensions = useMemo(() => [
    StarterKit,
    TaskList.configure({
      HTMLAttributes: {
        class: 'not-prose pl-2',
      },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'flex items-start gap-2 my-2',
      },
    }),
    TextStyle,
    Color,
    Underline,
  ], []);

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== prevContentRef.current) {
        shouldUpdateRef.current = true;
        selectionRef.current = {
          from: editor.state.selection.from,
          to: editor.state.selection.to
        };
        prevContentRef.current = html;
        onChange(html);
      }
    },
    onBlur,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[100px]',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== prevContentRef.current && !shouldUpdateRef.current) {
      const isFocused = editor.isFocused;
      const currentSelection = selectionRef.current || editor.state.selection;
      
      editor.commands.setContent(content, false);
      prevContentRef.current = content;
      
      if (isFocused) {
        editor.commands.focus();
        if (currentSelection) {
          editor.commands.setTextSelection(currentSelection);
        }
      }
    }
    shouldUpdateRef.current = false;
  }, [content, editor]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  const colors = [
    ['#FF0000', 'Red'],
    ['#00FF00', 'Green'],
    ['#0000FF', 'Blue'],
    ['#FFFF00', 'Yellow'],
    ['#FF00FF', 'Magenta'],
    ['#00FFFF', 'Cyan'],
  ];

  return (
    <div className="border rounded-md">
      <div className="border-b p-2 flex gap-2 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleUnderline().run();
          }}
          className={editor.isActive('underline') ? 'bg-muted' : ''}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleTaskList().run();
          }}
          className={editor.isActive('taskList') ? 'bg-muted' : ''}
        >
          <List className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 bg-background border-input">
            <div className="flex flex-col gap-1">
              {colors.map(([color, name]) => (
                <Button
                  key={color}
                  type="button"
                  variant="ghost"
                  className="justify-start hover:bg-muted"
                  onClick={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setColor(color).run();
                  }}
                >
                  <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color }} />
                  {name}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-background border-input">
            <Picker
              data={data}
              onEmojiSelect={(emoji: any) => {
                editor.chain().focus().insertContent(emoji.native).run();
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <EditorContent editor={editor} className="prose dark:prose-invert max-w-none p-4" />
    </div>
  );
});

export { RichTextEditor };