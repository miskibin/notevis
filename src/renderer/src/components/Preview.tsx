import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { splitSegments } from '../viz/segments'
import { VizBlock } from './VizBlock'

export function Preview({ content }: { content: string }): JSX.Element {
  const segments = useMemo(() => splitSegments(content), [content])
  return (
    <div className="preview">
      {segments.map((seg, i) =>
        seg.type === 'viz' ? (
          <VizBlock key={i} source={seg.source} />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {seg.text}
          </ReactMarkdown>
        )
      )}
    </div>
  )
}
