
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '../ui/button';
import { Bold, Underline as UnderlineIcon, List, Type, Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { memo, useEffect, useMemo, useRef } from 'react';
import debounce from 'lodash/debounce';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

const RichTextEditor = memo(function RichTextEditor({ 
  content, 
  onChange, 
  onBlur, 
  placeholder,
  className 
}: RichTextEditorProps) {
  const prevContentRef = useRef(content);
  const isUserEditingRef = useRef(false);

  const debouncedOnChange = useMemo(
    () => debounce((html: string) => {
      if (isUserEditingRef.current) {
        onChange(html);
      }
    }, 300),
    [onChange]
  );

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
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
    placeholder ? Placeholder.configure({
      placeholder,
      emptyEditorClass: 'is-editor-empty',
    }) : null,
  ].filter(Boolean), [placeholder]);

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== prevContentRef.current) {
        isUserEditingRef.current = true;
        prevContentRef.current = html;
        debouncedOnChange(html);
      }
    },
    onBlur,
    editorProps: {
      attributes: {
        class: cn('prose dark:prose-invert max-w-none focus:outline-none min-h-[100px]', className),
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
      editor?.destroy();
      debouncedOnChange.cancel();
    };
  }, [editor, debouncedOnChange]);

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
    <div className={cn("border rounded-md", className)}>
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
