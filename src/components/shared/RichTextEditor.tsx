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
import { memo, useEffect, useMemo, useState, useCallback, useRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
}

export const RichTextEditor = memo(({ content, onChange, onBlur }: RichTextEditorProps) => {
  const [internalContent, setInternalContent] = useState(content);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevContentRef = useRef(content);

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

  const handleUpdate = useCallback(({ editor }: { editor: any }) => {
    const html = editor.getHTML();

    if (html !== prevContentRef.current) {
      setInternalContent(html);
      prevContentRef.current = html;

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        console.log('Editor content updated:', html);
        onChange(html);
      }, 300);
    }
  }, [onChange]);

  const editor = useEditor({
    extensions,
    content: internalContent,
    onUpdate: handleUpdate,
    onBlur: () => {
      console.log('Editor blur event');
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[100px]',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== prevContentRef.current) {
      console.log('Content prop changed:', content);
      editor.commands.setContent(content, false);
      setInternalContent(content);
      prevContentRef.current = content;
    }
  }, [content, editor]);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
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

RichTextEditor.displayName = 'RichTextEditor';