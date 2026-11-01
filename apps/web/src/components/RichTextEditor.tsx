import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading3, Italic, List, ListOrdered, Redo2, Undo2 } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  invalid?: boolean;
  minHeight?: number;
  id?: string;
}

export function RichTextEditor({ value, onChange, placeholder, invalid, minHeight = 140, id }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3] }, link: { openOnClick: false } }), Placeholder.configure({ placeholder })],
    content: value,
    immediatelyRender: true,
    editorProps: { attributes: { class: 'prose-rf tiptap px-3.5 py-3', ...(id ? { id } : {}), 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });

  // Sync external changes (e.g. accepting an AI draft) without clobbering in-progress typing.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current) editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      heading: e?.isActive('heading', { level: 3 }) ?? false,
    }),
  });

  if (!editor) return null;
  const tools = [
    { icon: Bold, label: 'Bold', active: state?.bold, run: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, label: 'Italic', active: state?.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { icon: Heading3, label: 'Heading', active: state?.heading, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { icon: List, label: 'Bullet list', active: state?.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, label: 'Numbered list', active: state?.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div className={cn('overflow-hidden rounded-lg border border-input bg-card shadow-xs transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15', invalid && 'border-destructive')}>
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
            aria-label={t.label}
            aria-pressed={t.active}
            className={cn('rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground', t.active && 'bg-card text-foreground shadow-xs')}
          >
            <t.icon className="size-4" />
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} aria-label="Undo" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
          <Undo2 className="size-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} aria-label="Redo" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
          <Redo2 className="size-4" />
        </button>
      </div>
      <div style={{ minHeight }} className="cursor-text" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
