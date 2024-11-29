import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Color from '@tiptap/extension-color';
import { Button } from '../ui/button';
import { Bold, Underline, List, Type, Smile } from 'lucide-react';
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
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Color,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-md">
      <div className="border-b p-2 flex gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-muted' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'bg-muted' : ''}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={editor.isActive('taskList') ? 'bg-muted' : ''}
        >
          <List className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40">
            <div className="flex flex-col gap-1">
              {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'].map((color) => (
                <Button
                  key={color}
                  variant="ghost"
                  className="justify-start"
                  onClick={() => editor.chain().focus().setColor(color).run()}
                >
                  <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color }} />
                  {color}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
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