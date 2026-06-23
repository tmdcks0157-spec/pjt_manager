import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/utils'

export default function MarkdownViewer({ content, className }: {
  content: string
  className?: string
}) {
  if (!content) return null
  return (
    <div className={cn('md-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
