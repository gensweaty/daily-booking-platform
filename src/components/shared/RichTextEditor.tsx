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

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export const RichTextEditor = ({ content, onChange }: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
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
    ],
    content,
    onUpdate: ({ editor }) => {
      // Prevent auto-save on every keystroke by using the HTML content
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[100px]',
      },
    },
  });

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
          <PopoverContent className="w-40">
            <div className="flex flex-col gap-1">
              {colors.map(([color, name]) => (
                <Button
                  key={color}
                  type="button"
                  variant="ghost"
                  className="justify-start"
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
          <PopoverContent className="w-auto p-0">
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
};